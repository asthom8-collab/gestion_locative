import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { api, resetDb, prisma, createProperty, createTenant, createLease, createUser } from './helpers'
import { taxTreatment } from '../src/lib/interventionTax'

beforeEach(resetDb)
afterAll(() => prisma.$disconnect())

const input = (propertyId: string, over: Record<string, unknown> = {}) => ({
  propertyId, title: 'Remplacement du chauffe-eau', kind: 'PLUMBING', date: '2026-03-12T00:00:00.000Z', cost: 850, ...over,
})
const add = (propertyId: string, over: Record<string, unknown> = {}, cookie?: string) =>
  (cookie ? api(cookie) : api()).post('/api/interventions').send(input(propertyId, over))

describe('/api/interventions', () => {
  it('saisit, modifie, filtre et supprime les interventions, avec les totaux', async () => {
    const p = await createProperty()
    const p2 = await createProperty({ name: 'Parking' })
    const i = (await add(p.id, { providerName: '  Plomberie Martin ', notes: '' }).expect(201)).body
    expect(i).toMatchObject({
      status: 'DONE', doneBy: 'PROFESSIONAL', paidBy: 'OWNER', fiscalNature: 'MAINTENANCE', providerName: 'Plomberie Martin', notes: null,
      property: { id: p.id, name: 'T2 Lyon' }, lease: null, documents: [],
      tax: { code: 'DEDUCTIBLE', amount: 850 },
    })
    await add(p.id, { title: 'Peinture séjour', kind: 'PAINTING', doneBy: 'OWNER', cost: 120, date: '2025-06-01T00:00:00.000Z' }).expect(201)
    await add(p2.id, { title: 'Porte de garage', kind: 'CARPENTRY', status: 'PLANNED', cost: 1500 }).expect(201)
    await add(p.id, { title: 'Dégât des eaux', kind: 'DAMAGE', paidBy: 'INSURANCE', cost: 2000 }).expect(201)

    const all = (await api().get('/api/interventions').expect(200)).body
    expect(all.items).toHaveLength(4)
    expect(all.years).toEqual([2026, 2025])
    // Dépenses : seulement ce qui est fait et payé par le propriétaire
    expect(all.totals).toEqual({ ownerCost: 970, deductible: 970, depreciable: 0, planned: 1500 })

    const y2026 = (await api().get(`/api/interventions?year=2026&propertyId=${p.id}`).expect(200)).body
    expect(y2026.items.map((x: { title: string }) => x.title).sort()).toEqual(['Dégât des eaux', 'Remplacement du chauffe-eau'])
    expect((await api().get('/api/interventions?kind=PAINTING').expect(200)).body.items).toHaveLength(1)

    const upd = (await api().patch(`/api/interventions/${i.id}`).send({ fiscalNature: 'CONSTRUCTION', cost: 900 }).expect(200)).body
    expect(upd.tax).toMatchObject({ code: 'NOT_DEDUCTIBLE', amount: 0 })
    await api().delete(`/api/interventions/${i.id}`).expect(204)
    await api().get(`/api/interventions/${i.id}`).expect(404)
  })

  it('refuse un bail d’un autre bien et des données invalides', async () => {
    const p = await createProperty()
    const other = await createProperty({ name: 'Autre' })
    const lease = await createLease(other.id, (await createTenant()).id)
    await add(p.id, { leaseId: lease.id }).expect(400)
    await add(p.id, { title: '' }).expect(400)
    await add(p.id, { cost: -1 }).expect(400)
    await add(p.id, { kind: 'ROOFING' }).expect(400)
    const ok = (await add(other.id, { leaseId: lease.id }).expect(201)).body
    expect(ok.lease).toMatchObject({ id: lease.id, tenant: { firstName: 'Jean', lastName: 'Dupont' } })
    expect((await api().get(`/api/interventions?leaseId=${lease.id}`).expect(200)).body.items).toHaveLength(1)
    await api().patch(`/api/interventions/${ok.id}`).send({ leaseId: null }).expect(200)
  })

  it('isole les interventions des biens d’un autre propriétaire', async () => {
    const p = await createProperty()
    const i = (await add(p.id).expect(201)).body
    const other = await createUser()
    expect((await api(other.cookie).get('/api/interventions').expect(200)).body.items).toEqual([])
    await add(p.id, {}, other.cookie).expect(404)
    await api(other.cookie).patch(`/api/interventions/${i.id}`).send({ cost: 1 }).expect(404)
    await api(other.cookie).delete(`/api/interventions/${i.id}`).expect(404)
  })

  it('rattache factures et devis : document du bien, gardé si l’intervention est supprimée', async () => {
    const p = await createProperty()
    const i = (await add(p.id).expect(201)).body
    const pdf = Buffer.from('%PDF-1.4 facture')
    const doc = (await api().post(`/api/documents?interventionId=${i.id}&category=INVOICE&fileName=facture.pdf`)
      .set('Content-Type', 'application/pdf').send(pdf).expect(201)).body
    expect(doc).toMatchObject({ propertyId: p.id, interventionId: i.id, intervention: { id: i.id, title: 'Remplacement du chauffe-eau' } })
    await api().post(`/api/documents?interventionId=${i.id}&propertyId=${p.id}&category=QUOTE&fileName=devis.pdf`)
      .set('Content-Type', 'application/pdf').send(pdf).expect(400)
    expect((await api().get(`/api/interventions/${i.id}`).expect(200)).body.documents).toEqual([
      { id: doc.id, label: 'facture.pdf', category: 'INVOICE', mimeType: 'application/pdf' },
    ])
    expect((await api().get(`/api/documents?interventionId=${i.id}`).expect(200)).body).toHaveLength(1)

    const other = await createUser()
    await api(other.cookie).post(`/api/documents?interventionId=${i.id}&category=INVOICE&fileName=x.pdf`)
      .set('Content-Type', 'application/pdf').send(pdf).expect(404)

    await api().delete(`/api/interventions/${i.id}`).expect(204)
    const [kept] = (await api().get(`/api/documents?propertyId=${p.id}`).expect(200)).body
    expect(kept).toMatchObject({ id: doc.id, interventionId: null })
  })

  it('applique le type du bien : amélioration d’un local commercial non déductible', async () => {
    const shop = await createProperty({ name: 'Boutique', type: 'COMMERCIAL' })
    const i = (await add(shop.id, { title: 'Climatisation', kind: 'HEATING', fiscalNature: 'IMPROVEMENT' }).expect(201)).body
    expect(i.tax).toMatchObject({ code: 'NOT_DEDUCTIBLE', amount: 0 })
    expect((await api().get('/api/interventions').expect(200)).body.totals.deductible).toBe(0)
  })

  it('part avec le bien supprimé', async () => {
    const p = await createProperty()
    await add(p.id).expect(201)
    await api().delete(`/api/properties/${p.id}`).expect(204)
    expect(await prisma.intervention.count()).toBe(0)
  })
})

describe('traitement fiscal des interventions', () => {
  const base = { status: 'DONE', paidBy: 'OWNER', doneBy: 'PROFESSIONAL', fiscalNature: 'MAINTENANCE', cost: 100 } as const

  it('location nue et Pinel : entretien et amélioration déductibles, construction non', () => {
    expect(taxTreatment(base, 'NU')).toMatchObject({ code: 'DEDUCTIBLE', amount: 100 })
    expect(taxTreatment({ ...base, fiscalNature: 'IMPROVEMENT' }, 'PINEL')).toMatchObject({ code: 'DEDUCTIBLE', amount: 100 })
    expect(taxTreatment({ ...base, fiscalNature: 'CONSTRUCTION' }, 'NU')).toMatchObject({ code: 'NOT_DEDUCTIBLE', amount: 0 })
  })

  it('local commercial en location nue : amélioration non déductible, entretien déductible', () => {
    expect(taxTreatment({ ...base, fiscalNature: 'IMPROVEMENT' }, 'NU', 'COMMERCIAL')).toMatchObject({ code: 'NOT_DEDUCTIBLE', amount: 0 })
    expect(taxTreatment(base, 'NU', 'COMMERCIAL')).toMatchObject({ code: 'DEDUCTIBLE', amount: 100 })
    expect(taxTreatment({ ...base, fiscalNature: 'IMPROVEMENT' }, 'NU', 'APARTMENT')).toMatchObject({ code: 'DEDUCTIBLE' })
  })

  it('LMNP : charge ou immobilisation au réel, rien au micro-BIC', () => {
    expect(taxTreatment(base, 'LMNP_REEL')).toMatchObject({ code: 'DEDUCTIBLE', amount: 100 })
    expect(taxTreatment({ ...base, fiscalNature: 'IMPROVEMENT' }, 'LMNP_REEL')).toMatchObject({ code: 'DEPRECIABLE', amount: 100 })
    expect(taxTreatment(base, 'LMNP_MICRO')).toMatchObject({ code: 'NONE', amount: 0 })
  })

  it('travaux faits soi-même : matériaux seulement ; prévue, ou payée par un autre : rien', () => {
    expect(taxTreatment({ ...base, doneBy: 'OWNER' }, 'NU').label).toMatch(/matériaux/)
    expect(taxTreatment({ ...base, status: 'PLANNED' }, 'NU').code).toBe('NONE')
    expect(taxTreatment({ ...base, paidBy: 'TENANT' }, 'NU').code).toBe('NONE')
    expect(taxTreatment({ ...base, paidBy: 'INSURANCE' }, 'LMNP_REEL').code).toBe('NONE')
  })
})
