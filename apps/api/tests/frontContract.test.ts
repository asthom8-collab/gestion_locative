import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { api, resetDb, prisma, createProperty, createTenant, createLease } from './helpers'
import { DEV_USER_ID } from '../src/lib/devUser'
import { notificationsService } from '../src/services/notifications'

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
    expect(keys(me)).toEqual(expect.arrayContaining(['id', 'email', 'firstName', 'lastName', 'role', 'address', 'zipCode', 'city', 'mustChangePassword', 'hasSignature',
      'notifyDaysBefore', 'notifyEmail', 'ntfyTopic', 'freeMobileUser', 'hasFreeMobileKey']))
    expect(me).not.toHaveProperty('freeMobileKey')
    expect(me).not.toHaveProperty('signaturePath')
    expect(me).not.toHaveProperty('passwordHash')
  })

  it('phase 4 : révision IRL, charges et régularisation (types de apps/web/src/types, section Phase 4)', async () => {
    const p = await createProperty()
    const t = await createTenant()
    const lease = await createLease(p.id, t.id, { startDate: '2025-01-15T00:00:00.000Z', irlReference: 140, irlQuarter: 2, irlYear: 2024 })
    await api().put('/api/irl').send({ quarter: 2, year: 2025, value: 145.6 }).expect(200)
    expect(keys((await api().get('/api/irl')).body[0])).toEqual(expect.arrayContaining(['id', 'quarter', 'year', 'value']))

    const preview = (await api().get(`/api/leases/${lease.id}/revisions/preview?date=2026-01-15T00:00:00.000Z`).expect(200)).body
    expect(keys(preview)).toEqual(['computedRent', 'currentRent', 'effectiveDate', 'expectedIndex', 'lastRevisionDate', 'leaseId', 'missing', 'newIndex', 'nextRevisionDate', 'reference'])
    expect(keys(preview.newIndex)).toEqual(['quarter', 'value', 'year'])
    await api().post(`/api/leases/${lease.id}/revisions`).send({ effectiveDate: '2026-01-15T00:00:00.000Z' }).expect(201)
    const [rev] = (await api().get(`/api/leases/${lease.id}/revisions`)).body
    expect(keys(rev)).toEqual(expect.arrayContaining(['id', 'leaseId', 'effectiveDate', 'previousRent', 'newRent', 'previousIrlValue', 'previousIrlQuarter', 'previousIrlYear', 'newIrlValue', 'newIrlYear', 'createdAt']))
    const [listed] = (await api().get('/api/leases')).body
    expect(listed.rentRevisions).toEqual([{ effectiveDate: '2026-01-15T00:00:00.000Z' }])

    const charge = (await api().post('/api/charges').send({ propertyId: p.id, year: 2025, label: 'Eau', amount: 300 }).expect(201)).body
    expect(keys(charge)).toEqual(expect.arrayContaining(['id', 'propertyId', 'year', 'quarter', 'label', 'amount']))
    const reg = (await api().get(`/api/leases/${lease.id}/regularizations/preview?year=2025`).expect(200)).body
    expect(keys(reg)).toEqual(['charges', 'daysInYear', 'existing', 'missingMonths', 'occupiedDays', 'outdated', 'suggestedMonthlyCharges', 'totalCharged', 'totalCharges', 'totalReal', 'year', 'balance'].sort())
    expect(keys(reg.charges[0])).toEqual(['amount', 'id', 'label', 'occupiedDays', 'periodDays', 'quarter', 'share'])
    await api().post(`/api/leases/${lease.id}/regularizations`).send({ year: 2025 }).expect(201)
    const [saved] = (await api().get(`/api/leases/${lease.id}/regularizations`)).body
    expect(keys(saved)).toEqual(expect.arrayContaining(['id', 'leaseId', 'year', 'occupiedDays', 'daysInYear', 'totalCharged', 'totalReal', 'balance', 'sentAt', 'createdAt']))
    // Charge modifiée après coup : la régularisation enregistrée est signalée (OutdatedRegularization)
    await api().patch(`/api/charges/${charge.id}`).send({ amount: 400 }).expect(200)
    const [stale] = (await api().get('/api/charges/outdated-regularizations').expect(200)).body
    expect(keys(stale)).toEqual(['balance', 'createdAt', 'currentBalance', 'id', 'leaseId', 'propertyName', 'tenantName', 'year'])
    const [alloc] = (await api().get('/api/charges/allocation?year=2025').expect(200)).body
    expect(keys(alloc.tenants[0].regularization)).toEqual(['balance', 'currentBalance', 'id', 'outdated'])
  })

  it('notifications, quotes-parts datées et répartition des charges', async () => {
    const p = await createProperty()
    const t = await createTenant()
    await createLease(p.id, t.id, { startDate: '2025-01-01T00:00:00.000Z', irlReference: 140, irlQuarter: 2, irlYear: 2024 })
    await notificationsService.runRevisionReminders(new Date('2025-12-01'))
    const [n] = (await api().get('/api/notifications').expect(200)).body
    expect(keys(n)).toEqual(['body', 'createdAt', 'dueDate', 'id', 'kind', 'leaseId', 'link', 'readAt', 'title'])
    const owners = (await api().put(`/api/properties/${p.id}/owners`).send({ owners: [{ userId: DEV_USER_ID, share: 1, startDate: '2020-01-01' }] }).expect(200)).body
    expect(keys(owners[0])).toEqual(expect.arrayContaining(['id', 'userId', 'share', 'startDate', 'endDate', 'user']))
    await api().post('/api/charges').send({ propertyId: p.id, year: 2026, quarter: 1, label: 'Eau', amount: 100 }).expect(201)
    const [a] = (await api().get('/api/charges/allocation?year=2026').expect(200)).body
    expect(keys(a)).toEqual(['owners', 'propertyId', 'propertyName', 'tenants', 'total', 'vacancy'])
    expect(keys(a.owners[0])).toEqual(['amount', 'endDate', 'name', 'share', 'startDate', 'userId'])
    expect(keys(a.tenants[0])).toEqual(['balance', 'endDate', 'leaseId', 'missingMonths', 'occupiedDays', 'provisions', 'regularization', 'share', 'startDate', 'tenantName'])
    const [u] = (await api().get('/api/notifications/upcoming').expect(200)).body
    expect(keys(u)).toEqual(['anniversary', 'daysLeft', 'leaseId', 'propertyName', 'remindOn', 'sentAt', 'status', 'tenantName'])
  })
})
