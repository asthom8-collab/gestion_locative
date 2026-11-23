import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { api, resetDb, prisma, createProperty, createTenant, createLease, createUser } from './helpers'

beforeEach(resetDb)
afterAll(() => prisma.$disconnect())

const addCharge = (propertyId: string, label: string, amount: number, year = 2026) =>
  api().post('/api/charges').send({ propertyId, year, label, amount })

describe('/api/charges', () => {
  it('saisit, modifie, liste par année et supprime les charges d’un bien', async () => {
    const p = await createProperty()
    const c = (await addCharge(p.id, 'Taxe d’ordures ménagères', 240).expect(201)).body
    await addCharge(p.id, 'Eau', 300, 2025).expect(201)
    await api().patch(`/api/charges/${c.id}`).send({ amount: 250 }).expect(200)
    const list = (await api().get('/api/charges?year=2026').expect(200)).body
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ label: 'Taxe d’ordures ménagères', amount: 250, propertyId: p.id })
    await api().delete(`/api/charges/${c.id}`).expect(204)
    expect((await api().get(`/api/charges?propertyId=${p.id}`)).body).toHaveLength(1)
    await addCharge(p.id, '', 10).expect(400)
  })

  it('isole les charges des biens d’un autre propriétaire', async () => {
    const p = await createProperty()
    const c = (await addCharge(p.id, 'Eau', 300).expect(201)).body
    const other = await createUser()
    expect((await api(other.cookie).get('/api/charges').expect(200)).body).toEqual([])
    await api(other.cookie).post('/api/charges').send({ propertyId: p.id, year: 2026, label: 'X', amount: 1 }).expect(404)
    await api(other.cookie).delete(`/api/charges/${c.id}`).expect(404)
  })
})

describe('régularisation des charges', () => {
  async function setup(over: Record<string, unknown> = {}) {
    const p = await createProperty()
    const t = await createTenant()
    const lease = await createLease(p.id, t.id, { startDate: '2026-04-01T00:00:00.000Z', chargesAmount: 50, ...over })
    return { p, lease }
  }
  const generate = (month: number) => api().post('/api/rent-payments/generate').send({ year: 2026, month })

  it('calcule la part du locataire au prorata de l’occupation, moins les provisions appelées', async () => {
    const { p, lease } = await setup()
    await addCharge(p.id, 'Eau', 600)
    await addCharge(p.id, 'Entretien', 130)
    for (const m of [4, 5, 6]) await generate(m)
    const res = await api().get(`/api/leases/${lease.id}/regularizations/preview?year=2026`).expect(200)
    // 1er avril → 31 décembre : 275 jours sur 365 ; 730 × 275 / 365 = 550
    expect(res.body).toMatchObject({
      occupiedDays: 275, daysInYear: 365, totalCharges: 730, totalReal: 550,
      totalCharged: 150, balance: 400, missingMonths: [7, 8, 9, 10, 11, 12], suggestedMonthlyCharges: 60.83, existing: null,
    })
    expect(res.body.charges[0]).toMatchObject({ label: 'Eau', amount: 600, share: 452.05 })
  })

  it('enregistre une régularisation par an, puis produit le décompte PDF', async () => {
    const { p, lease } = await setup({ startDate: '2025-01-01T00:00:00.000Z' })
    await api().post(`/api/leases/${lease.id}/regularizations`).send({ year: 2026 }).expect(409) // aucune charge
    await addCharge(p.id, 'Eau', 365)
    const reg = (await api().post(`/api/leases/${lease.id}/regularizations`).send({ year: 2026 }).expect(201)).body
    expect(reg).toMatchObject({ year: 2026, totalReal: 365, totalCharged: 0, balance: 365 })
    await api().post(`/api/leases/${lease.id}/regularizations`).send({ year: 2026 }).expect(409)
    expect((await api().get(`/api/leases/${lease.id}/regularizations`).expect(200)).body).toHaveLength(1)

    await api().patch('/api/me').send({ address: '5 place Bellecour', zipCode: '69002', city: 'Lyon' }).expect(200)
    const pdf = await api().get(`/api/leases/${lease.id}/regularizations/${reg.id}/statement`).expect(200)
    expect(pdf.headers['content-type']).toBe('application/pdf')
    await api().delete(`/api/leases/${lease.id}/regularizations/${reg.id}`).expect(204)
  })

  it('signale une régularisation périmée quand une charge est ajoutée, modifiée ou supprimée après coup', async () => {
    const { p, lease } = await setup({ startDate: '2025-01-01T00:00:00.000Z' })
    const eau = (await addCharge(p.id, 'Eau', 365).expect(201)).body
    const reg = (await api().post(`/api/leases/${lease.id}/regularizations`).send({ year: 2026 }).expect(201)).body
    const outdated = async () => (await api().get('/api/charges/outdated-regularizations').expect(200)).body
    const preview = async () => (await api().get(`/api/leases/${lease.id}/regularizations/preview?year=2026`).expect(200)).body
    expect(await outdated()).toEqual([])
    expect((await preview()).outdated).toBe(false)

    await api().patch(`/api/charges/${eau.id}`).send({ amount: 400 }).expect(200)
    expect(await outdated()).toMatchObject([{ id: reg.id, leaseId: lease.id, year: 2026, balance: 365, currentBalance: 400 }])
    expect((await preview()).outdated).toBe(true)
    const alloc = (await api().get('/api/charges/allocation?year=2026').expect(200)).body
    expect(alloc[0].tenants[0].regularization).toMatchObject({ id: reg.id, outdated: true, balance: 365, currentBalance: 400 })

    await api().patch(`/api/charges/${eau.id}`).send({ amount: 365 }).expect(200)
    expect(await outdated()).toEqual([])
    const tom = (await addCharge(p.id, 'Ordures', 50).expect(201)).body
    expect(await outdated()).toHaveLength(1)
    await api().delete(`/api/charges/${tom.id}`).expect(204)
    await api().delete(`/api/charges/${eau.id}`).expect(204)
    expect(await outdated()).toMatchObject([{ id: reg.id, currentBalance: 0 }])

    // Cloche : une seule notification « à refaire » (pas une par modification), retirée quand la régularisation est refaite
    const bell = async () => (await api().get('/api/notifications').expect(200)).body.filter((n: { kind: string }) => n.kind === 'REGULARIZATION_OUTDATED')
    expect(await bell()).toMatchObject([{ leaseId: lease.id, title: 'Régularisation 2026 à refaire : Jean Dupont', link: `/leases/${lease.id}` }])
    await addCharge(p.id, 'Eau', 100).expect(201)
    expect(await bell()).toHaveLength(1)
    await api().delete(`/api/leases/${lease.id}/regularizations/${reg.id}`).expect(204)
    expect(await bell()).toEqual([])
    await api().post(`/api/leases/${lease.id}/regularizations`).send({ year: 2026 }).expect(201)
    expect(await outdated()).toEqual([])

    // Un autre propriétaire ne voit pas l'alerte
    const other = await createUser()
    expect((await api(other.cookie).get('/api/charges/outdated-regularizations').expect(200)).body).toEqual([])
  })

  it('refuse une année que le bail ne couvre pas, et l’accès d’un autre propriétaire', async () => {
    const { lease } = await setup()
    await api().get(`/api/leases/${lease.id}/regularizations/preview?year=2025`).expect(400)
    const other = await createUser()
    await api(other.cookie).get(`/api/leases/${lease.id}/regularizations/preview?year=2026`).expect(404)
  })
})
