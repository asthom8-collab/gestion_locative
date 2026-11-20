import request from 'supertest'
import { app } from '../src/app'
import { prisma } from '../src/lib/prisma'
import { DEV_USER_ID } from '../src/lib/devUser'

export const api = () => request(app)

/** Vide toutes les tables puis recrée l'utilisateur de dev. */
export async function resetDb() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`
  if (tables.length) {
    const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ')
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`)
  }
  await prisma.user.create({
    data: {
      id: DEV_USER_ID,
      email: 'admin@local.dev',
      passwordHash: 'x',
      firstName: 'Admin',
      lastName: 'Test',
      role: 'ADMIN',
    },
  })
}

export const propertyInput = (over: Record<string, unknown> = {}) => ({
  name: 'T2 Lyon',
  address: '1 rue Test',
  zipCode: '69003',
  city: 'Lyon',
  type: 'APARTMENT',
  surface: 45,
  fiscalRegime: 'NU',
  irlQuarter: 2,
  ...over,
})

export const tenantInput = (over: Record<string, unknown> = {}) => ({
  firstName: 'Jean',
  lastName: 'Dupont',
  email: 'jean.dupont@example.com',
  ...over,
})

export async function createProperty(over: Record<string, unknown> = {}) {
  const res = await api().post('/api/properties').send(propertyInput(over)).expect(201)
  return res.body as { id: string }
}

export async function createTenant(over: Record<string, unknown> = {}) {
  const res = await api().post('/api/tenants').send(tenantInput(over)).expect(201)
  return res.body as { id: string }
}

export async function createLease(propertyId: string, tenantId: string, over: Record<string, unknown> = {}) {
  const res = await api()
    .post('/api/leases')
    .send({
      propertyId,
      tenantId,
      type: 'UNFURNISHED',
      startDate: '2025-01-01T00:00:00.000Z',
      rentAmount: 800,
      chargesAmount: 50,
      ...over,
    })
    .expect(201)
  return res.body as { id: string; active: boolean }
}

export { prisma }
