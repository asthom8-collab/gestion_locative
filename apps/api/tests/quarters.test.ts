import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { api, resetDb, prisma, createProperty, createTenant, createLease, createUser } from './helpers'
import { DEV_USER_ID } from '../src/lib/devUser'

beforeEach(resetDb)
afterAll(() => prisma.$disconnect())

const addCharge = (propertyId: string, label: string, amount: number, quarter: number | null = null) =>
  api().post('/api/charges').send({ propertyId, year: 2026, quarter, label, amount }).expect(201)

describe('quotes-parts datées', () => {
  it('vérifie la cohérence de la chronologie', async () => {
    const p = await createProperty()
    const claire = await createUser()
    const put = (owners: unknown) => api().put(`/api/properties/${p.id}/owners`).send({ owners })
    const err = async (owners: unknown) => (await put(owners).expect(400)).body.error
    expect(await err([{ userId: DEV_USER_ID, share: 1, endDate: '2026-06-30' }, { userId: claire.id, share: 1, startDate: '2026-07-05' }]))
      .toBe('La somme des quotes-parts doit faire 100 % au 01/07/2026 (actuellement 0 %)')
    expect(await err([{ userId: DEV_USER_ID, share: 1 }, { userId: claire.id, share: 1, startDate: '2026-07-01' }]))
      .toBe('La somme des quotes-parts doit faire 100 % au 01/07/2026 (actuellement 200 %)')
    expect(await err([{ userId: DEV_USER_ID, share: 1, endDate: '2026-06-30' }])).toMatch(/au moins un propriétaire actuel/)
    expect(await err([{ userId: DEV_USER_ID, share: 1, startDate: '2026-07-01', endDate: '2026-06-01' }, { userId: claire.id, share: 1 }])).toMatch(/précède/)

    const ok = await put([
      { userId: DEV_USER_ID, share: 1, endDate: '2026-06-30' },
      { userId: claire.id, share: 0.5, startDate: '2026-07-01' },
      { userId: DEV_USER_ID + '', share: 0.5, startDate: '2026-07-01' },
    ])
    expect(ok.status).toBe(400) // un propriétaire ne peut avoir qu'une période
    const res = await put([{ userId: DEV_USER_ID, share: 1, endDate: '2026-06-30' }, { userId: claire.id, share: 1, startDate: '2026-07-01' }]).expect(200)
    expect(res.body.map((o: { startDate: string | null; endDate: string | null }) => [o.startDate?.slice(0, 10) ?? null, o.endDate?.slice(0, 10) ?? null]))
      .toEqual([[null, '2026-06-30'], ['2026-07-01', null]])
    // L'ancien propriétaire garde l'accès au bien (historique)
    await api().get(`/api/properties/${p.id}`).expect(200)
  })
})

describe('charges par trimestre', () => {
  it('régularisation : chaque charge au prorata de l’occupation de sa période', async () => {
    const p = await createProperty()
    const t = await createTenant()
    const lease = await createLease(p.id, t.id, { startDate: '2026-04-01T00:00:00.000Z', chargesAmount: 0 })
    await addCharge(p.id, 'Eau', 300, 1)
    await addCharge(p.id, 'Eau', 300, 2)
    await addCharge(p.id, 'Taxe d’ordures ménagères', 365)
    const r = (await api().get(`/api/leases/${lease.id}/regularizations/preview?year=2026`).expect(200)).body
    expect(r.charges.map((c: { quarter: number | null; share: number }) => [c.quarter, c.share])).toEqual([[null, 275], [1, 0], [2, 300]])
    expect(r).toMatchObject({ totalCharges: 965, totalReal: 575, balance: 575 })
    await api().post('/api/charges').send({ propertyId: p.id, year: 2026, quarter: 5, label: 'X', amount: 1 }).expect(400)
  })

  it('répartit les charges entre propriétaires successifs', async () => {
    const p = await createProperty({ name: 'Studio' })
    const claire = await createUser()
    await api().put(`/api/properties/${p.id}/owners`).send({ owners: [
      { userId: DEV_USER_ID, share: 1, endDate: '2026-06-30' }, { userId: claire.id, share: 1, startDate: '2026-07-01' },
    ] }).expect(200)
    await addCharge(p.id, 'Eau', 300, 1)
    await addCharge(p.id, 'Eau', 400, 3)
    await addCharge(p.id, 'Taxe d’ordures ménagères', 365)
    const [a] = (await api(claire.cookie).get('/api/charges/allocation?year=2026').expect(200)).body
    expect(a).toMatchObject({ propertyName: 'Studio', total: 1065 })
    expect(a.owners.map((o: { name: string; amount: number }) => [o.name, o.amount])).toEqual([['Admin Test', 481], ['Claire Copro', 584]])
    expect((await api().get('/api/charges/allocation?year=2025').expect(200)).body).toEqual([])
  })
})
