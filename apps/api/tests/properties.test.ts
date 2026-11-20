import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { api, resetDb, prisma, propertyInput, createProperty, createTenant, createLease } from './helpers'

beforeEach(resetDb)
afterAll(() => prisma.$disconnect())

describe('/api/properties', () => {
  it('crée un bien rattaché à l’utilisateur avec une quote-part de 100 %', async () => {
    const res = await api().post('/api/properties').send(propertyInput()).expect(201)
    expect(res.body.name).toBe('T2 Lyon')
    expect(res.body.ownerships).toHaveLength(1)
    expect(res.body.ownerships[0].share).toBe(1)
  })

  it('liste les biens de l’utilisateur', async () => {
    await createProperty({ name: 'A' })
    await createProperty({ name: 'B' })
    const res = await api().get('/api/properties').expect(200)
    expect(res.body.map((p: { name: string }) => p.name).sort()).toEqual(['A', 'B'])
  })

  it('refuse un bien invalide (400 avec détail des champs)', async () => {
    const res = await api().post('/api/properties').send(propertyInput({ zipCode: '123', surface: -1 })).expect(400)
    const fields = res.body.details.map((d: { field: string }) => d.field)
    expect(fields).toEqual(expect.arrayContaining(['zipCode', 'surface']))
  })

  it('renvoie 404 pour un bien inconnu', async () => {
    await api().get('/api/properties/inconnu').expect(404)
  })

  it('met à jour un bien', async () => {
    const p = await createProperty()
    const res = await api().patch(`/api/properties/${p.id}`).send({ city: 'Villeurbanne' }).expect(200)
    expect(res.body.city).toBe('Villeurbanne')
  })

  it('supprime un bien sans bail', async () => {
    const p = await createProperty()
    await api().delete(`/api/properties/${p.id}`).expect(204)
    await api().get(`/api/properties/${p.id}`).expect(404)
  })

  it('refuse de supprimer un bien avec un bail actif (409)', async () => {
    const p = await createProperty()
    const t = await createTenant()
    await createLease(p.id, t.id)
    await api().delete(`/api/properties/${p.id}`).expect(409)
  })

  it('refuse de supprimer un bien avec un bail résilié (409, historique conservé)', async () => {
    const p = await createProperty()
    const t = await createTenant()
    const lease = await createLease(p.id, t.id)
    await api().post(`/api/leases/${lease.id}/terminate`).send({ endDate: '2025-12-31T00:00:00.000Z' }).expect(200)
    await api().delete(`/api/properties/${p.id}`).expect(409)
  })
})
