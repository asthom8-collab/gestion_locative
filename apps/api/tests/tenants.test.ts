import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { api, resetDb, prisma, tenantInput, createProperty, createTenant, createLease } from './helpers'

beforeEach(resetDb)
afterAll(() => prisma.$disconnect())

describe('/api/tenants', () => {
  it('crée puis liste un locataire', async () => {
    await api().post('/api/tenants').send(tenantInput()).expect(201)
    const res = await api().get('/api/tenants').expect(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].email).toBe('jean.dupont@example.com')
  })

  it('refuse un e-mail invalide (400)', async () => {
    await api().post('/api/tenants').send(tenantInput({ email: 'pas-un-email' })).expect(400)
  })

  it('met à jour un locataire', async () => {
    const t = await createTenant()
    const res = await api().patch(`/api/tenants/${t.id}`).send({ phone: '0600000000' }).expect(200)
    expect(res.body.phone).toBe('0600000000')
  })

  it('renvoie 404 pour un locataire inconnu', async () => {
    await api().get('/api/tenants/inconnu').expect(404)
  })

  it('supprime un locataire sans bail', async () => {
    const t = await createTenant()
    await api().delete(`/api/tenants/${t.id}`).expect(204)
  })

  it('refuse de supprimer un locataire avec un bail actif (409)', async () => {
    const p = await createProperty()
    const t = await createTenant()
    await createLease(p.id, t.id)
    await api().delete(`/api/tenants/${t.id}`).expect(409)
  })

  it('refuse de supprimer un locataire avec un bail résilié (409, historique conservé)', async () => {
    const p = await createProperty()
    const t = await createTenant()
    const lease = await createLease(p.id, t.id)
    await api().post(`/api/leases/${lease.id}/terminate`).send({ endDate: '2025-12-31T00:00:00.000Z' }).expect(200)
    await api().delete(`/api/tenants/${t.id}`).expect(409)
  })
})
