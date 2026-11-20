import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { api, resetDb, prisma, createProperty, createTenant, createLease } from './helpers'

beforeEach(resetDb)
afterAll(() => prisma.$disconnect())

describe('/api/leases', () => {
  it('crée un bail actif, visible dans la liste et par bien', async () => {
    const p = await createProperty()
    const t = await createTenant()
    const lease = await createLease(p.id, t.id)
    expect(lease.active).toBe(true)

    const all = await api().get('/api/leases').expect(200)
    expect(all.body).toHaveLength(1)
    const byProperty = await api().get(`/api/leases/property/${p.id}`).expect(200)
    expect(byProperty.body[0].id).toBe(lease.id)
  })

  it('refuse un second bail actif sur le même bien (409)', async () => {
    const p = await createProperty()
    const t1 = await createTenant()
    const t2 = await createTenant({ email: 'autre@example.com' })
    await createLease(p.id, t1.id)
    await api()
      .post('/api/leases')
      .send({ propertyId: p.id, tenantId: t2.id, type: 'UNFURNISHED', startDate: '2025-02-01T00:00:00.000Z', rentAmount: 700, chargesAmount: 0 })
      .expect(409)
  })

  it('refuse un bail invalide (400)', async () => {
    await api().post('/api/leases').send({ propertyId: 'x', rentAmount: -5 }).expect(400)
  })

  it('met à jour le loyer', async () => {
    const p = await createProperty()
    const t = await createTenant()
    const lease = await createLease(p.id, t.id)
    const res = await api().patch(`/api/leases/${lease.id}`).send({ rentAmount: 820 }).expect(200)
    expect(res.body.rentAmount).toBe(820)
  })

  it('résilie un bail, puis refuse une seconde résiliation (409)', async () => {
    const p = await createProperty()
    const t = await createTenant()
    const lease = await createLease(p.id, t.id)
    const res = await api().post(`/api/leases/${lease.id}/terminate`).send({ endDate: '2025-12-31T00:00:00.000Z' }).expect(200)
    expect(res.body.active).toBe(false)
    await api().post(`/api/leases/${lease.id}/terminate`).send({ endDate: '2025-12-31T00:00:00.000Z' }).expect(409)
  })

  it('permet un nouveau bail une fois le précédent résilié', async () => {
    const p = await createProperty()
    const t = await createTenant()
    const lease = await createLease(p.id, t.id)
    await api().post(`/api/leases/${lease.id}/terminate`).send({ endDate: '2025-12-31T00:00:00.000Z' }).expect(200)
    await createLease(p.id, t.id, { startDate: '2026-01-01T00:00:00.000Z' })
  })

  it('renvoie 404 si le bien ou le locataire n’existe pas', async () => {
    const t = await createTenant()
    await api()
      .post('/api/leases')
      .send({ propertyId: 'clxxxxxxxxxxxxxxxxxxxxxxx', tenantId: t.id, type: 'UNFURNISHED', startDate: '2025-01-01T00:00:00.000Z', rentAmount: 700, chargesAmount: 0 })
      .expect(404)
  })

  it('renvoie 404 pour un bail inconnu', async () => {
    await api().get('/api/leases/inconnu').expect(404)
  })
})
