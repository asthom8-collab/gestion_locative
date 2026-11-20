import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { api, resetDb, prisma, createProperty, createTenant, createLease, createUser, propertyInput } from './helpers'
import { DEV_USER_ID } from '../src/lib/devUser'

beforeEach(resetDb)
afterAll(() => prisma.$disconnect())

/** Un bien de l'admin avec un bail et une échéance, et une seconde propriétaire (Claire) sans accès. */
async function setup() {
  const p = await createProperty()
  const t = await createTenant()
  const l = await createLease(p.id, t.id)
  await api().post('/api/rent-payments/generate').send({ year: 2026, month: 4 }).expect(201)
  const [rp] = (await api().get('/api/rent-payments?year=2026&month=4').expect(200)).body
  const claire = await createUser()
  return { p, t, l, rp, claire }
}

describe('isolation entre propriétaires', () => {
  it('un autre utilisateur ne voit rien des biens, locataires, baux et échéances de l’admin', async () => {
    const { claire } = await setup()
    const as = api(claire.cookie)
    expect((await as.get('/api/properties').expect(200)).body).toEqual([])
    expect((await as.get('/api/tenants').expect(200)).body).toEqual([])
    expect((await as.get('/api/leases').expect(200)).body).toEqual([])
    expect((await as.get('/api/rent-payments?year=2026&month=4').expect(200)).body).toEqual([])
  })

  it('… et reçoit 404 (sans savoir que la ressource existe) en lecture comme en écriture', async () => {
    const { p, t, l, rp, claire } = await setup()
    const as = api(claire.cookie)
    await as.get(`/api/properties/${p.id}`).expect(404)
    await as.patch(`/api/properties/${p.id}`).send({ name: 'Piraté' }).expect(404)
    await as.delete(`/api/properties/${p.id}`).expect(404)
    await as.put(`/api/properties/${p.id}/owners`).send({ owners: [{ userId: claire.id, share: 1 }] }).expect(404)
    await as.get(`/api/tenants/${t.id}`).expect(404)
    await as.patch(`/api/tenants/${t.id}`).send({ firstName: 'X' }).expect(404)
    await as.get(`/api/leases/${l.id}`).expect(404)
    await as.patch(`/api/leases/${l.id}`).send({ rentAmount: 1 }).expect(404)
    await as.post(`/api/leases/${l.id}/terminate`).send({ endDate: '2026-12-31T00:00:00.000Z' }).expect(404)
    await as.put(`/api/rent-payments/${rp.id}/payment`).send({ receivedAmount: 850, paymentDate: '2026-04-02T00:00:00.000Z' }).expect(404)
    await as.delete(`/api/rent-payments/${rp.id}`).expect(404)
    await as.post(`/api/rent-payments/${rp.id}/receipt`).expect(404)
    await as.get(`/api/rent-payments/${rp.id}/receipt`).expect(404)
    // Rien n'a changé
    expect((await api().get(`/api/leases/${l.id}`).expect(200)).body).toMatchObject({ active: true, rentAmount: 800 })
  })

  it('ne peut pas créer de bail sur le bien d’un autre, ni avec son locataire (404)', async () => {
    const { p, t, claire } = await setup()
    const as = api(claire.cookie)
    const own = (await as.post('/api/properties').send(propertyInput({ name: 'Studio Claire' })).expect(201)).body
    const ownTenant = (await as.post('/api/tenants').send({ firstName: 'Léa', lastName: 'Loc', email: 'lea@example.com' }).expect(201)).body
    const lease = { type: 'UNFURNISHED', startDate: '2026-01-01T00:00:00.000Z', rentAmount: 500, chargesAmount: 0 }
    await as.post('/api/leases').send({ ...lease, propertyId: p.id, tenantId: ownTenant.id }).expect(404)
    await as.post('/api/leases').send({ ...lease, propertyId: own.id, tenantId: t.id }).expect(404)
    await as.post('/api/leases').send({ ...lease, propertyId: own.id, tenantId: ownTenant.id }).expect(201)
  })

  it('la génération du mois ne crée que les échéances des biens de l’utilisateur', async () => {
    const { claire } = await setup()
    const as = api(claire.cookie)
    const own = (await as.post('/api/properties').send(propertyInput({ name: 'Studio Claire' })).expect(201)).body
    const ownTenant = (await as.post('/api/tenants').send({ firstName: 'Léa', lastName: 'Loc', email: 'lea@example.com' }).expect(201)).body
    await as.post('/api/leases').send({ propertyId: own.id, tenantId: ownTenant.id, type: 'UNFURNISHED', startDate: '2026-01-01T00:00:00.000Z', rentAmount: 500, chargesAmount: 0 }).expect(201)
    const res = await as.post('/api/rent-payments/generate').send({ year: 2026, month: 5 }).expect(201)
    expect(res.body.created).toBe(1)
    expect(res.body.payments.map((p: { lease: { property: { name: string } } }) => p.lease.property.name)).toEqual(['Studio Claire'])
    expect((await api().get('/api/rent-payments?year=2026&month=5').expect(200)).body).toEqual([])
  })
})

describe('copropriété', () => {
  it('ajoute une copropriétaire : elle voit le bien, son bail, son locataire et ses échéances', async () => {
    const { p, t, l, rp, claire } = await setup()
    const res = await api().put(`/api/properties/${p.id}/owners`).send({
      owners: [{ userId: DEV_USER_ID, share: 0.6 }, { userId: claire.id, share: 0.4 }],
    }).expect(200)
    expect(res.body.map((o: { share: number; user: { firstName: string } }) => [o.user.firstName, o.share])).toEqual([['Admin', 0.6], ['Claire', 0.4]])

    const as = api(claire.cookie)
    const [prop] = (await as.get('/api/properties').expect(200)).body
    expect(prop.ownerships).toHaveLength(2)
    expect((await as.get(`/api/leases/${l.id}`).expect(200)).body.id).toBe(l.id)
    expect((await as.get(`/api/tenants/${t.id}`).expect(200)).body.id).toBe(t.id)
    // Mêmes droits : elle peut encaisser
    await as.put(`/api/rent-payments/${rp.id}/payment`).send({ receivedAmount: 850, paymentDate: '2026-04-02T00:00:00.000Z' }).expect(200)
  })

  it('refuse une somme différente de 100 %, un doublon, ou de se retirer soi-même (400)', async () => {
    const { p, claire } = await setup()
    const put = (owners: unknown) => api().put(`/api/properties/${p.id}/owners`).send({ owners })
    expect((await put([{ userId: DEV_USER_ID, share: 0.5 }, { userId: claire.id, share: 0.3 }]).expect(400)).body.error).toMatch(/100 %/)
    await put([{ userId: DEV_USER_ID, share: 0.5 }, { userId: DEV_USER_ID, share: 0.5 }]).expect(400)
    expect((await put([{ userId: claire.id, share: 1 }]).expect(400)).body.error).toMatch(/vous retirer/)
    await put([{ userId: DEV_USER_ID, share: 0.5 }, { userId: 'inconnu', share: 0.5 }]).expect(404)
    await put([]).expect(400)
  })

  it('retirer une copropriétaire lui retire l’accès', async () => {
    const { p, claire } = await setup()
    await api().put(`/api/properties/${p.id}/owners`).send({ owners: [{ userId: DEV_USER_ID, share: 0.5 }, { userId: claire.id, share: 0.5 }] }).expect(200)
    await api().put(`/api/properties/${p.id}/owners`).send({ owners: [{ userId: DEV_USER_ID, share: 1 }] }).expect(200)
    await api(claire.cookie).get(`/api/properties/${p.id}`).expect(404)
  })

  it('un locataire commun à deux propriétaires : chacun ne voit que ses propres baux', async () => {
    const { t, claire } = await setup()
    // Claire loue son bien au même locataire : il faut qu'elle le voie, donc on passe par la base
    const own = (await api(claire.cookie).post('/api/properties').send(propertyInput({ name: 'Studio Claire' })).expect(201)).body
    await prisma.lease.create({ data: { propertyId: own.id, tenantId: t.id, type: 'UNFURNISHED', startDate: new Date('2026-01-01'), rentAmount: 500, chargesAmount: 0 } })
    const [seenByClaire] = (await api(claire.cookie).get('/api/tenants').expect(200)).body
    expect(seenByClaire.leases.map((l: { property: { name: string } }) => l.property.name)).toEqual(['Studio Claire'])
    const [seenByAdmin] = (await api().get('/api/tenants').expect(200)).body
    expect(seenByAdmin.leases.map((l: { property: { name: string } }) => l.property.name)).toEqual(['T2 Lyon'])
    // Suppression refusée : il a des baux, même chez l'autre propriétaire
    await api().post(`/api/leases/${seenByAdmin.leases[0].id}/terminate`).send({ endDate: '2026-06-30T00:00:00.000Z' }).expect(200)
    await api().delete(`/api/tenants/${t.id}`).expect(409)
  })
})

describe('historiques complets', () => {
  it('les listes de biens et de locataires renvoient aussi les baux terminés', async () => {
    const { p, t, l } = await setup()
    await api().post(`/api/leases/${l.id}/terminate`).send({ endDate: '2026-06-30T00:00:00.000Z' }).expect(200)
    const l2 = await createLease(p.id, t.id, { startDate: '2026-07-01T00:00:00.000Z' })
    const [prop] = (await api().get('/api/properties').expect(200)).body
    expect(prop.leases.map((x: { id: string; active: boolean }) => [x.id, x.active])).toEqual([[l2.id, true], [l.id, false]])
    const [tenant] = (await api().get('/api/tenants').expect(200)).body
    expect(tenant.leases).toHaveLength(2)
  })
})
