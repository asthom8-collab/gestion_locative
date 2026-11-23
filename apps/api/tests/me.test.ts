import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { api, resetDb, prisma } from './helpers'

beforeEach(resetDb)
afterAll(() => prisma.$disconnect())

describe('/api/me', () => {
  it('renvoie le profil sans le hash du mot de passe', async () => {
    const res = await api().get('/api/me').expect(200)
    expect(res.body.email).toBe('admin@local.dev')
    expect(res.body).not.toHaveProperty('passwordHash')
  })

  it('met à jour l’adresse du bailleur, une chaîne vide efface le champ', async () => {
    const res = await api()
      .patch('/api/me')
      .send({ address: ' 5 place Bellecour ', zipCode: '69002', city: 'Lyon' })
      .expect(200)
    expect(res.body).toMatchObject({ address: '5 place Bellecour', zipCode: '69002', city: 'Lyon' })

    const cleared = await api().patch('/api/me').send({ address: '' }).expect(200)
    expect(cleared.body.address).toBeNull()
  })

  it('change l’adresse e-mail, enregistrée en minuscules', async () => {
    const res = await api().patch('/api/me').send({ email: ' Thomas@Exemple.FR ' }).expect(200)
    expect(res.body.email).toBe('thomas@exemple.fr')
    expect(await prisma.user.count({ where: { email: 'thomas@exemple.fr' } })).toBe(1)
  })

  it('refuse une adresse e-mail invalide (400) ou déjà prise (409)', async () => {
    await api().patch('/api/me').send({ email: 'pas-une-adresse' }).expect(400)
    await prisma.user.create({ data: { email: 'autre@exemple.fr', firstName: 'A', lastName: 'B', passwordHash: 'x' } })
    await api().patch('/api/me').send({ email: 'autre@exemple.fr' }).expect(409)
    await api().patch('/api/me').send({ email: 'admin@local.dev' }).expect(200)
  })

  it('refuse un prénom vide (400)', async () => {
    await api().patch('/api/me').send({ firstName: '' }).expect(400)
  })
})
