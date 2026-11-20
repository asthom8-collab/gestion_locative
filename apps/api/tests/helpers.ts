import request from 'supertest'
import { hash } from 'bcrypt'
import { app } from '../src/app'
import { prisma } from '../src/lib/prisma'
import { DEV_USER_ID } from '../src/lib/devUser'
import { SESSION_COOKIE, createSessionToken } from '../src/lib/auth'

/** Cookie de session valide pour un utilisateur (sans passer par /login). */
export const cookieFor = (userId: string, sessionVersion = 0) => `${SESSION_COOKIE}=${createSessionToken(userId, sessionVersion)}`

/**
 * Client HTTP de test. Par défaut connecté en tant qu'utilisateur de dev (admin) ;
 * api(cookieFor(autreId)) pour un autre utilisateur, api(null) sans être connecté.
 */
export const api = (cookie: string | null = cookieFor(DEV_USER_ID)) => {
  const r = request(app)
  const auth = (t: request.Test) => (cookie ? t.set('Cookie', cookie) : t)
  return {
    get: (url: string) => auth(r.get(url)),
    post: (url: string) => auth(r.post(url)),
    put: (url: string) => auth(r.put(url)),
    patch: (url: string) => auth(r.patch(url)),
    delete: (url: string) => auth(r.delete(url)),
  }
}

/** Second utilisateur (rôle USER), avec son cookie de session. */
export async function createUser(email = 'claire@local.dev', firstName = 'Claire', lastName = 'Copro') {
  const user = await prisma.user.create({
    data: { email, firstName, lastName, passwordHash: await hash('motdepasse-claire', 4), role: 'USER' },
  })
  return { id: user.id, cookie: cookieFor(user.id) }
}

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
