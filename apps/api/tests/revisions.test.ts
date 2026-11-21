import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { lastPublishedYear } from '../src/services/revisions'
import { api, resetDb, prisma, createProperty, createTenant, createLease, createUser } from './helpers'

beforeEach(resetDb)
afterAll(() => prisma.$disconnect())

const IRL = { irlReference: 140, irlQuarter: 2, irlYear: 2024 }

async function setup(over: Record<string, unknown> = IRL) {
  const p = await createProperty()
  const t = await createTenant()
  return createLease(p.id, t.id, { startDate: '2025-01-15T00:00:00.000Z', rentAmount: 800, ...over })
}
const setIrl = (quarter: number, year: number, value: number) => api().put('/api/irl').send({ quarter, year, value })
const apply = (leaseId: string, body: Record<string, unknown>) => api().post(`/api/leases/${leaseId}/revisions`).send(body)

describe('lastPublishedYear (publication de l’INSEE vers le 15 du mois suivant le trimestre)', () => {
  it.each([
    [2, '2026-07-14', 2025], [2, '2026-07-15', 2026], [1, '2026-04-20', 2026], [3, '2026-01-10', 2025],
    [4, '2026-01-14', 2024], [4, '2026-01-15', 2025],
  ])('T%i au %s → %i', (q, date, year) => {
    expect(lastPublishedYear(q, new Date(`${date}T00:00:00.000Z`))).toBe(year)
  })
})

describe('/api/irl', () => {
  it('enregistre et corrige un indice (un seul par trimestre)', async () => {
    await setIrl(2, 2025, 145).expect(200)
    await setIrl(2, 2025, 145.5).expect(200)
    const res = await api().get('/api/irl').expect(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0]).toMatchObject({ quarter: 2, year: 2025, value: 145.5 })
    await setIrl(5, 2025, 1).expect(400)
  })
})

describe('révision du loyer', () => {
  it('signale ce qui manque : IRL de référence du bail, puis indice de l’année suivante', async () => {
    const sans = await setup({})
    expect((await api().get(`/api/leases/${sans.id}/revisions/preview`).expect(200)).body.missing).toBe('REFERENCE')
    const lease = await createLease((await createProperty({ name: 'B2' })).id, (await createTenant({ email: 'b@x.fr' })).id, { startDate: '2025-01-15T00:00:00.000Z', ...IRL })
    const res = await api().get(`/api/leases/${lease.id}/revisions/preview?date=2026-01-15T00:00:00.000Z`).expect(200)
    expect(res.body).toMatchObject({ missing: 'INDEX', expectedIndex: { quarter: 2, year: 2025 }, nextRevisionDate: '2026-01-15T00:00:00.000Z' })
    await apply(lease.id, { effectiveDate: '2026-01-15T00:00:00.000Z' }).expect(409)
  })

  it('calcule le loyer révisé, l’applique, puis refuse une 2e révision dans l’année', async () => {
    const lease = await setup()
    await setIrl(2, 2025, 145.6).expect(200)
    const preview = await api().get(`/api/leases/${lease.id}/revisions/preview?date=2026-01-15T00:00:00.000Z`).expect(200)
    // 800 × 145,6 / 140 = 832
    expect(preview.body).toMatchObject({ missing: null, computedRent: 832, newIndex: { value: 145.6, year: 2025 } })

    await apply(lease.id, { effectiveDate: '2026-01-01T00:00:00.000Z' }).expect(400) // avant l'anniversaire
    await apply(lease.id, { effectiveDate: '2026-01-15T00:00:00.000Z', newRent: 840 }).expect(400) // plus que l'IRL
    await apply(lease.id, { effectiveDate: '2026-01-15T00:00:00.000Z' }).expect(201)

    const l = await api().get(`/api/leases/${lease.id}`).expect(200)
    expect(l.body).toMatchObject({ rentAmount: 832, irlReference: 145.6, irlQuarter: 2, irlYear: 2025 })
    const next = await api().get(`/api/leases/${lease.id}/revisions/preview`).expect(200)
    expect(next.body).toMatchObject({ missing: 'INDEX', nextRevisionDate: '2027-01-15T00:00:00.000Z' })
    await setIrl(2, 2026, 150).expect(200)
    await apply(lease.id, { effectiveDate: '2026-06-01T00:00:00.000Z' }).expect(400)
  })

  it('n’utilise pas un indice publié après la date d’effet', async () => {
    const lease = await setup()
    await setIrl(2, 2025, 145.6)
    await setIrl(2, 2026, 150)
    const res = await apply(lease.id, { effectiveDate: '2026-01-15T00:00:00.000Z' }).expect(201)
    expect(res.body).toMatchObject({ newIrlValue: 145.6, newIrlYear: 2025, newRent: 832 })
  })

  it('accepte un loyer inférieur au calcul', async () => {
    const lease = await setup()
    await setIrl(2, 2025, 145.6)
    const res = await apply(lease.id, { effectiveDate: '2026-02-01T00:00:00.000Z', newRent: 820 }).expect(201)
    expect(res.body).toMatchObject({ previousRent: 800, newRent: 820, previousIrlValue: 140, newIrlValue: 145.6 })
  })

  it('proratise le mois de la révision et recalcule les échéances non payées', async () => {
    const lease = await setup()
    await setIrl(2, 2025, 145.6)
    // Janvier généré avant la révision, février payé : seul janvier (non payé) est recalculé
    await api().post('/api/rent-payments/generate').send({ year: 2026, month: 1 }).expect(201)
    await api().post('/api/rent-payments/generate').send({ year: 2026, month: 2 }).expect(201)
    const feb = (await api().get(`/api/rent-payments?leaseId=${lease.id}&year=2026&month=2`)).body[0]
    await api().put(`/api/rent-payments/${feb.id}/payment`).send({ receivedAmount: 850, paymentDate: '2026-02-03T00:00:00.000Z' }).expect(200)

    await apply(lease.id, { effectiveDate: '2026-01-15T00:00:00.000Z' }).expect(201)
    const rows = (await api().get(`/api/rent-payments?leaseId=${lease.id}`)).body as { periodMonth: number; rentAmount: number }[]
    // Janvier : 14 jours à 800 + 17 jours à 832, sur 31
    expect(rows.find((r) => r.periodMonth === 1)!.rentAmount).toBe(817.55)
    expect(rows.find((r) => r.periodMonth === 2)!.rentAmount).toBe(800)
    await api().post('/api/rent-payments/generate').send({ year: 2026, month: 3 }).expect(201)
    const march = (await api().get(`/api/rent-payments?leaseId=${lease.id}&year=2026&month=3`)).body[0]
    expect(march.rentAmount).toBe(832)
  })

  it('annule uniquement la dernière révision et restaure le bail', async () => {
    const lease = await setup()
    await setIrl(2, 2025, 145.6)
    await setIrl(2, 2026, 150)
    const r1 = (await apply(lease.id, { effectiveDate: '2026-01-15T00:00:00.000Z' }).expect(201)).body
    const r2 = (await apply(lease.id, { effectiveDate: '2027-01-15T00:00:00.000Z' }).expect(201)).body
    expect(r2.newRent).toBe(857.14) // 832 × 150 / 145,6
    await api().delete(`/api/leases/${lease.id}/revisions/${r1.id}`).expect(409)
    await api().delete(`/api/leases/${lease.id}/revisions/${r2.id}`).expect(204)
    const l = (await api().get(`/api/leases/${lease.id}`)).body
    expect(l).toMatchObject({ rentAmount: 832, irlReference: 145.6, irlYear: 2025 })
    const list = (await api().get(`/api/leases/${lease.id}/revisions`).expect(200)).body
    expect(list.map((r: { id: string }) => r.id)).toEqual([r1.id])
  })

  it('produit l’avis de révision en PDF (adresse du bailleur requise)', async () => {
    const lease = await setup()
    await setIrl(2, 2025, 145.6)
    const r = (await apply(lease.id, { effectiveDate: '2026-01-15T00:00:00.000Z' })).body
    await api().get(`/api/leases/${lease.id}/revisions/${r.id}/letter`).expect(409)
    await api().patch('/api/me').send({ address: '5 place Bellecour', zipCode: '69002', city: 'Lyon' }).expect(200)
    const pdf = await api().get(`/api/leases/${lease.id}/revisions/${r.id}/letter?download`).expect(200)
    expect(pdf.headers['content-type']).toBe('application/pdf')
    expect(pdf.headers['content-disposition']).toMatch(/^attachment; filename="revision-loyer-2026-Dupont.pdf"/)
  })

  it('n’est pas accessible à un autre propriétaire', async () => {
    const lease = await setup()
    const other = await createUser()
    await api(other.cookie).get(`/api/leases/${lease.id}/revisions/preview`).expect(404)
    await api(other.cookie).post(`/api/leases/${lease.id}/revisions`).send({ effectiveDate: '2026-01-15T00:00:00.000Z' }).expect(404)
  })
})
