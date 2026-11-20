import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { api, resetDb, prisma, createProperty, createTenant, createLease } from './helpers'

beforeEach(resetDb)
afterAll(() => prisma.$disconnect())

/**
 * Contrat avec le front : les champs que lisent les écrans (et que simulent les tests du front,
 * dans apps/web/src/test/utils.tsx et les *.test.tsx). Si l'un de ces tests casse, il faut mettre à jour
 * les types (apps/web/src/types) et les données simulées du front en même temps.
 */
const keys = (o: object) => Object.keys(o).sort()

describe('contrat API ↔ front', () => {
  it('biens, locataires et baux : champs et relations utilisés par les écrans', async () => {
    const p = await createProperty()
    const t = await createTenant()
    await createLease(p.id, t.id)

    const [property] = (await api().get('/api/properties').expect(200)).body
    expect(keys(property)).toEqual(expect.arrayContaining(
      ['id', 'name', 'address', 'zipCode', 'city', 'type', 'surface', 'fiscalRegime', 'irlQuarter', 'leases', 'ownerships']))
    expect(keys(property.leases[0])).toEqual(expect.arrayContaining(['id', 'active', 'tenant']))
    expect(keys(property.ownerships[0].user)).toEqual(['firstName', 'id', 'lastName'])

    const [tenant] = (await api().get('/api/tenants').expect(200)).body
    expect(keys(tenant)).toEqual(expect.arrayContaining(['id', 'firstName', 'lastName', 'email', 'phone', 'leases']))
    expect(keys(tenant.leases[0].property)).toEqual(['city', 'id', 'name'])

    const [lease] = (await api().get('/api/leases').expect(200)).body
    expect(keys(lease)).toEqual(expect.arrayContaining(
      ['id', 'propertyId', 'tenantId', 'type', 'startDate', 'endDate', 'rentAmount', 'chargesAmount', 'rentDayOfMonth', 'active']))
    // Pas de date de fin : null (et pas absent), le front teste `if (l.endDate)`
    expect(lease.endDate).toBeNull()
    expect(keys(lease.property)).toEqual(['address', 'city', 'id', 'name'])
    expect(keys(lease.tenant)).toEqual(['email', 'firstName', 'id', 'lastName'])
  })

  it('échéances : champs lus par la page Loyers et le tableau de bord', async () => {
    const p = await createProperty()
    const t = await createTenant()
    await createLease(p.id, t.id)
    await api().post('/api/rent-payments/generate').send({ year: 2026, month: 4 }).expect(201)

    const [rp] = (await api().get('/api/rent-payments?year=2026&month=4').expect(200)).body
    expect(keys(rp)).toEqual(expect.arrayContaining([
      'id', 'leaseId', 'periodYear', 'periodMonth', 'periodStart', 'periodEnd', 'rentAmount', 'chargesAmount',
      'expectedAmount', 'receivedAmount', 'paymentDate', 'status', 'dueDate', 'receipt', 'lease']))
    expect(rp.receipt).toBeNull()
    expect(['PENDING', 'RECEIVED', 'PARTIAL', 'LATE']).toContain(rp.status)
    // Le tableau de bord retrouve le type du bien via lease.property.id
    expect(rp.lease.property.id).toBe(p.id)
    expect(keys(rp.lease)).toEqual(['id', 'property', 'rentDayOfMonth', 'tenant'])
  })

  it('fiche du bail : bail, bien complet, locataire complet, et échéances filtrées par bail', async () => {
    const p = await createProperty()
    const t = await createTenant({ phone: '0601020304' })
    const l = await createLease(p.id, t.id)
    await api().post('/api/rent-payments/generate').send({ year: 2026, month: 4 }).expect(201)

    const lease = (await api().get(`/api/leases/${l.id}`).expect(200)).body
    expect(keys(lease)).toEqual(expect.arrayContaining(['id', 'type', 'startDate', 'endDate', 'rentAmount', 'chargesAmount', 'rentDayOfMonth', 'active', 'property', 'tenant']))
    expect(lease.property).toMatchObject({ id: p.id, type: 'APARTMENT', zipCode: '69003' })
    expect(lease.tenant).toMatchObject({ id: t.id, email: 'jean.dupont@example.com', phone: '0601020304' })

    const payments = (await api().get(`/api/rent-payments?leaseId=${l.id}`).expect(200)).body
    expect(payments).toHaveLength(1)
    expect(payments[0]).toMatchObject({ leaseId: l.id, periodYear: 2026, periodMonth: 4 })
    expect(payments[0].status).toBeDefined()
  })

  it('profil : champs de la page Paramètres et de la barre latérale', async () => {
    const me = (await api().get('/api/me').expect(200)).body
    expect(keys(me)).toEqual(expect.arrayContaining(['id', 'email', 'firstName', 'lastName', 'role', 'address', 'zipCode', 'city', 'mustChangePassword', 'hasSignature']))
    expect(me).not.toHaveProperty('signaturePath')
    expect(me).not.toHaveProperty('passwordHash')
  })
})
