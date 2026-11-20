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

  it('refuse un prénom vide (400)', async () => {
    await api().patch('/api/me').send({ firstName: '' }).expect(400)
  })
})
