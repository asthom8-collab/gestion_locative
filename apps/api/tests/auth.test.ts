import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import request from 'supertest'
import { hash } from 'bcrypt'
import { app } from '../src/app'
import { api, resetDb, prisma, cookieFor, createProperty } from './helpers'
import { DEV_USER_ID } from '../src/lib/devUser'
import { createSessionToken, readSessionToken } from '../src/lib/auth'

beforeEach(resetDb)
afterAll(() => prisma.$disconnect())

const setPassword = async (password: string) =>
  prisma.user.update({ where: { id: DEV_USER_ID }, data: { passwordHash: await hash(password, 4) } })

/** Extrait le cookie de session d'une réponse */
const sessionFrom = (res: request.Response) => {
  const raw = ([] as string[]).concat(res.headers['set-cookie'] ?? [])
  return raw.find((c) => c.startsWith('gl_session='))
}

describe('connexion', () => {
  it('refuse l’accès à l’API sans session (401), mais pas /health', async () => {
    await api(null).get('/api/properties').expect(401)
    await api(null).get('/api/me').expect(401)
    await request(app).get('/health').expect(200)
  })

  it('connecte avec le bon mot de passe : cookie HttpOnly, puis accès à l’API', async () => {
    await setPassword('bonmotdepasse')
    const res = await request(app).post('/api/auth/login').send({ email: 'ADMIN@local.dev', password: 'bonmotdepasse' }).expect(200)
    expect(res.body).toMatchObject({ email: 'admin@local.dev', role: 'ADMIN', hasSignature: false })
    expect(res.body.passwordHash).toBeUndefined()
    const cookie = sessionFrom(res)!
    expect(cookie).toMatch(/HttpOnly/)
    expect(cookie).toMatch(/SameSite=Lax/)
    await api(cookie.split(';')[0]).get('/api/properties').expect(200)
  })

  it('refuse un mauvais mot de passe ou un e-mail inconnu avec le même message (401)', async () => {
    await setPassword('bonmotdepasse')
    const a = await request(app).post('/api/auth/login').send({ email: 'admin@local.dev', password: 'faux' }).expect(401)
    const b = await request(app).post('/api/auth/login').send({ email: 'inconnu@local.dev', password: 'faux' }).expect(401)
    expect(a.body.error).toBe(b.body.error)
    expect(sessionFrom(a)).toBeUndefined()
  })

  it('rejette un cookie falsifié ou expiré', async () => {
    const token = createSessionToken(DEV_USER_ID, 0)
    const [data] = token.split('.')
    await api(`gl_session=${data}.signature-fausse`).get('/api/me').expect(401)
    const forged = Buffer.from(JSON.stringify({ uid: DEV_USER_ID, v: 0, exp: Date.now() + 1e9 })).toString('base64url')
    await api(`gl_session=${forged}.${token.split('.')[1]}`).get('/api/me').expect(401)
    expect(readSessionToken(createSessionToken(DEV_USER_ID, 0, Date.now() - 31 * 24 * 3600 * 1000))).toBeNull()
  })

  it('la déconnexion efface le cookie', async () => {
    const res = await api().post('/api/auth/logout').expect(204)
    expect(sessionFrom(res)).toMatch(/gl_session=;/)
  })
})

describe('mot de passe', () => {
  it('change le mot de passe : les anciennes sessions sont fermées, la nouvelle fonctionne', async () => {
    await setPassword('ancienmotdepasse')
    const old = cookieFor(DEV_USER_ID)
    const res = await api(old).put('/api/me/password').send({ currentPassword: 'ancienmotdepasse', newPassword: 'nouveau-mot-de-passe' }).expect(200)
    await api(old).get('/api/me').expect(401)
    await api(sessionFrom(res)!.split(';')[0]).get('/api/me').expect(200)
    await request(app).post('/api/auth/login').send({ email: 'admin@local.dev', password: 'nouveau-mot-de-passe' }).expect(200)
  })

  it('refuse un mot de passe actuel faux (400) ou trop court (400)', async () => {
    await setPassword('ancienmotdepasse')
    await api().put('/api/me/password').send({ currentPassword: 'faux', newPassword: 'nouveau-mot-de-passe' }).expect(400)
    await api().put('/api/me/password').send({ currentPassword: 'ancienmotdepasse', newPassword: 'court' }).expect(400)
  })
})

describe('comptes créés par l’administrateur', () => {
  it('crée un compte avec mot de passe provisoire : accès limité jusqu’au changement', async () => {
    const created = await api().post('/api/users').send({ email: 'Claire@Local.dev', firstName: 'Claire', lastName: 'Copro', password: 'provisoire-123' }).expect(201)
    expect(created.body).toMatchObject({ email: 'claire@local.dev', role: 'USER', mustChangePassword: true })
    await api().post('/api/users').send({ email: 'claire@local.dev', firstName: 'C', lastName: 'C', password: 'provisoire-123' }).expect(409)

    const login = await request(app).post('/api/auth/login').send({ email: 'claire@local.dev', password: 'provisoire-123' }).expect(200)
    const cookie = sessionFrom(login)!.split(';')[0]
    await api(cookie).get('/api/me').expect(200)
    await api(cookie).get('/api/properties').expect(403)
    const changed = await api(cookie).put('/api/me/password').send({ currentPassword: 'provisoire-123', newPassword: 'mon-vrai-mot-de-passe' }).expect(200)
    expect(changed.body.mustChangePassword).toBe(false)
    await api(sessionFrom(changed)!.split(';')[0]).get('/api/properties').expect(200)
  })

  it('création, mot de passe et rôle réservés aux administrateurs (403)', async () => {
    const claire = await prisma.user.create({ data: { email: 'claire@local.dev', firstName: 'Claire', lastName: 'Copro', passwordHash: 'x' } })
    const cookie = cookieFor(claire.id)
    await api(cookie).post('/api/users').send({ email: 'x@local.dev', firstName: 'X', lastName: 'Y', password: 'provisoire-123' }).expect(403)
    await api(cookie).put(`/api/users/${DEV_USER_ID}/password`).send({ password: 'provisoire-123' }).expect(403)
    await api(cookie).put(`/api/users/${DEV_USER_ID}/role`).send({ role: 'USER' }).expect(403)
  })

  it('annuaire : l’administrateur voit tous les comptes et leur rôle, un propriétaire seulement ses copropriétaires', async () => {
    const claire = await prisma.user.create({ data: { email: 'claire@local.dev', firstName: 'Claire', lastName: 'Copro', passwordHash: 'x' } })
    const paul = await prisma.user.create({ data: { email: 'paul@local.dev', firstName: 'Paul', lastName: 'Autre', passwordHash: 'x' } })
    const emails = (body: { email: string }[]) => body.map((u) => u.email).sort()
    const all = (await api().get('/api/users').expect(200)).body
    expect(emails(all)).toEqual(['admin@local.dev', 'claire@local.dev', 'paul@local.dev'])
    expect(Object.keys(all[0]).sort()).toEqual(['email', 'firstName', 'id', 'lastName', 'role'])

    // Claire ne voit qu'elle-même, puis l'admin une fois copropriétaire d'un de ses biens ; jamais Paul
    expect(emails((await api(cookieFor(claire.id)).get('/api/users').expect(200)).body)).toEqual(['claire@local.dev'])
    const p = await createProperty()
    await api().put(`/api/properties/${p.id}/owners`).send({ owners: [{ userId: DEV_USER_ID, share: 0.5 }, { userId: claire.id, share: 0.5 }] }).expect(200)
    const dir = (await api(cookieFor(claire.id)).get('/api/users').expect(200)).body
    expect(emails(dir)).toEqual(['admin@local.dev', 'claire@local.dev'])
    expect(Object.keys(dir[0]).sort()).toEqual(['email', 'firstName', 'id', 'lastName'])
    expect(emails((await api(cookieFor(paul.id)).get('/api/users').expect(200)).body)).toEqual(['paul@local.dev'])
  })

  it('l’administrateur change le rôle d’un compte, pas le sien', async () => {
    const claire = await prisma.user.create({ data: { email: 'claire@local.dev', firstName: 'Claire', lastName: 'Copro', passwordHash: 'x' } })
    expect((await api().put(`/api/users/${claire.id}/role`).send({ role: 'ADMIN' }).expect(200)).body).toMatchObject({ id: claire.id, role: 'ADMIN' })
    await api(cookieFor(claire.id)).post('/api/users').send({ email: 'x@local.dev', firstName: 'X', lastName: 'Y', password: 'provisoire-123' }).expect(201)
    await api().put(`/api/users/${DEV_USER_ID}/role`).send({ role: 'USER' }).expect(400)
    await api().put(`/api/users/${claire.id}/role`).send({ role: 'ROOT' }).expect(400)
  })

  it('l’administrateur réinitialise un mot de passe : sessions fermées, mot de passe provisoire', async () => {
    const claire = await prisma.user.create({ data: { email: 'claire@local.dev', firstName: 'Claire', lastName: 'Copro', passwordHash: 'x' } })
    await api().put(`/api/users/${claire.id}/password`).send({ password: 'provisoire-456' }).expect(204)
    await api(cookieFor(claire.id)).get('/api/me').expect(401)
    const login = await request(app).post('/api/auth/login').send({ email: 'claire@local.dev', password: 'provisoire-456' }).expect(200)
    expect(login.body.mustChangePassword).toBe(true)
  })
})
