import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { api, resetDb, prisma, createProperty, createTenant, createLease, createUser } from './helpers'
import { DEV_USER_ID } from '../src/lib/devUser'

beforeEach(resetDb)
afterAll(() => prisma.$disconnect())

// Image PNG de 1 × 1 pixel
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
const png = `data:image/png;base64,${PNG}`

const binary = (req: ReturnType<ReturnType<typeof api>['get']>) =>
  req.buffer(true).parse((res, cb) => {
    const chunks: Buffer[] = []
    res.on('data', (c: Buffer) => chunks.push(c))
    res.on('end', () => cb(null, Buffer.concat(chunks)))
  })

const address = { address: '5 place Bellecour', zipCode: '69002', city: 'Lyon' }

describe('signature du bailleur', () => {
  it('enregistre, relit puis supprime la signature', async () => {
    const saved = await api().put('/api/me/signature').send({ image: png }).expect(200)
    expect(saved.body.hasSignature).toBe(true)
    expect(saved.body.signaturePath).toBeUndefined()
    const file = await binary(api().get('/api/me/signature')).expect(200)
    expect(file.headers['content-type']).toBe('image/png')
    expect((file.body as Buffer).equals(Buffer.from(PNG, 'base64'))).toBe(true)

    expect((await api().delete('/api/me/signature').expect(200)).body.hasSignature).toBe(false)
    await api().get('/api/me/signature').expect(404)
  })

  it('refuse ce qui n’est pas une vraie image PNG ou JPEG (400)', async () => {
    await api().put('/api/me/signature').send({ image: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' }).expect(400)
    // Type annoncé PNG, contenu texte
    const fake = `data:image/png;base64,${Buffer.from('<svg onload=alert(1)>').toString('base64')}`
    expect((await api().put('/api/me/signature').send({ image: fake }).expect(400)).body.error).toMatch(/ne correspond pas/)
    await api().put('/api/me/signature').send({ image: 'pas une image' }).expect(400)
  })

  it('refuse une image trop lourde (400)', async () => {
    const big = Buffer.concat([Buffer.from(PNG, 'base64'), Buffer.alloc(310 * 1024)])
    await api().put('/api/me/signature').send({ image: `data:image/png;base64,${big.toString('base64')}` }).expect(400)
  })

  it('appose la signature de chaque copropriétaire sur la quittance', async () => {
    const claire = await createUser()
    const p = await createProperty()
    const t = await createTenant()
    await createLease(p.id, t.id)
    await api().put(`/api/properties/${p.id}/owners`).send({ owners: [{ userId: DEV_USER_ID, share: 0.5 }, { userId: claire.id, share: 0.5 }] }).expect(200)
    await api().patch('/api/me').send(address).expect(200)
    await api(claire.cookie).patch('/api/me').send(address).expect(200)
    await api().post('/api/rent-payments/generate').send({ year: 2026, month: 3 }).expect(201)
    const [rp] = (await api().get('/api/rent-payments?year=2026&month=3').expect(200)).body
    await api().put(`/api/rent-payments/${rp.id}/payment`).send({ receivedAmount: rp.expectedAmount, paymentDate: '2026-03-02T00:00:00.000Z' }).expect(200)

    const imagesInReceipt = async () => {
      await api().post(`/api/rent-payments/${rp.id}/receipt`).expect(201)
      const pdf = (await binary(api().get(`/api/rent-payments/${rp.id}/receipt`)).expect(200)).body as Buffer
      return (pdf.toString('latin1').match(/\/Subtype \/Image/g) ?? []).length
    }
    const none = await imagesInReceipt()
    await api().put('/api/me/signature').send({ image: png }).expect(200)
    const one = await imagesInReceipt()
    await api(claire.cookie).put('/api/me/signature').send({ image: png }).expect(200)
    const two = await imagesInReceipt()
    expect(none).toBe(0)
    expect(one).toBeGreaterThan(0)
    expect(two).toBe(one * 2)
  })
})
