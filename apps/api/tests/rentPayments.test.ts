import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { api, resetDb, prisma, createProperty, createTenant, createLease } from './helpers'

beforeEach(resetDb)
afterAll(() => prisma.$disconnect())

async function setupLease(over: Record<string, unknown> = {}) {
  const p = await createProperty()
  const t = await createTenant()
  return createLease(p.id, t.id, over)
}

const generate = (year: number, month: number) =>
  api().post('/api/rent-payments/generate').send({ year, month })

const setLandlordAddress = () =>
  api().patch('/api/me').send({ address: '5 place Bellecour', zipCode: '69002', city: 'Lyon' }).expect(200)

describe('/api/rent-payments/generate', () => {
  it('crée l’échéance du mois une seule fois (idempotent)', async () => {
    const lease = await setupLease()
    const first = await generate(2026, 3).expect(201)
    expect(first.body.created).toBe(1)
    expect(first.body.payments[0]).toMatchObject({
      leaseId: lease.id,
      rentAmount: 800,
      chargesAmount: 50,
      expectedAmount: 850,
      periodStart: '2026-03-01T00:00:00.000Z',
      periodEnd: '2026-03-31T00:00:00.000Z',
    })

    const second = await generate(2026, 3).expect(200)
    expect(second.body.created).toBe(0)
    expect(second.body.payments).toHaveLength(1)
  })

  it('proratise au jour le premier mois du bail', async () => {
    await setupLease({ startDate: '2026-03-15T00:00:00.000Z' })
    const res = await generate(2026, 3).expect(201)
    // 17 jours sur 31
    expect(res.body.payments[0]).toMatchObject({
      periodStart: '2026-03-15T00:00:00.000Z',
      rentAmount: 438.71,
      chargesAmount: 27.42,
      expectedAmount: 466.13,
    })
  })

  it('proratise le dernier mois d’un bail résilié, puis ne génère plus rien', async () => {
    const lease = await setupLease()
    await api().post(`/api/leases/${lease.id}/terminate`).send({ endDate: '2026-04-10T00:00:00.000Z' }).expect(200)

    const april = await generate(2026, 4).expect(201)
    // 10 jours sur 30, date de fin incluse
    expect(april.body.payments[0]).toMatchObject({
      periodEnd: '2026-04-10T00:00:00.000Z',
      // loyer 266.67 + charges 16.67, arrondis séparément comme sur la quittance
      expectedAmount: 283.34,
    })
    const may = await generate(2026, 5).expect(200)
    expect(may.body.created).toBe(0)
  })

  it('ignore les baux qui commencent après le mois', async () => {
    await setupLease({ startDate: '2026-06-01T00:00:00.000Z' })
    const res = await generate(2026, 5).expect(200)
    expect(res.body.payments).toHaveLength(0)
  })

  it('refuse un mois invalide (400)', async () => {
    await generate(2026, 13).expect(400)
  })
})

describe('/api/rent-payments', () => {
  it('liste par mois, avec bien et locataire', async () => {
    await setupLease()
    await generate(2026, 3)
    await generate(2026, 4)
    const res = await api().get('/api/rent-payments?year=2026&month=4').expect(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].lease.property.name).toBe('T2 Lyon')
    expect(res.body[0].lease.tenant.lastName).toBe('Dupont')
  })

  it('refuse un filtre non numérique (400)', async () => {
    await api().get('/api/rent-payments?year=abc').expect(400)
  })

  it('marque en retard une échéance passée non payée', async () => {
    await setupLease()
    const res = await generate(2025, 1).expect(201)
    expect(res.body.payments[0].status).toBe('LATE')
    expect(res.body.payments[0].dueDate).toBe('2025-01-01T00:00:00.000Z')
  })

  it('enregistre un paiement partiel puis complet, et l’annule', async () => {
    await setupLease()
    const { body } = await generate(2026, 3)
    const id = body.payments[0].id

    const partial = await api().put(`/api/rent-payments/${id}/payment`)
      .send({ receivedAmount: 400, paymentDate: '2026-03-02T00:00:00.000Z' }).expect(200)
    expect(partial.body.status).toBe('PARTIAL')

    const full = await api().put(`/api/rent-payments/${id}/payment`)
      .send({ receivedAmount: 850, paymentDate: '2026-03-05T00:00:00.000Z' }).expect(200)
    expect(full.body).toMatchObject({ status: 'RECEIVED', receivedAmount: 850 })

    const cancelled = await api().delete(`/api/rent-payments/${id}/payment`).expect(200)
    expect(cancelled.body.receivedAmount).toBeNull()
    expect(cancelled.body.status).not.toBe('RECEIVED')
  })

  it('refuse un montant négatif (400) et une échéance inconnue (404)', async () => {
    await setupLease()
    const { body } = await generate(2026, 3)
    await api().put(`/api/rent-payments/${body.payments[0].id}/payment`)
      .send({ receivedAmount: -1, paymentDate: '2026-03-02T00:00:00.000Z' }).expect(400)
    await api().put('/api/rent-payments/inconnu/payment')
      .send({ receivedAmount: 10, paymentDate: '2026-03-02T00:00:00.000Z' }).expect(404)
  })

  it('supprime une échéance non payée, refuse si un paiement est saisi (409)', async () => {
    await setupLease()
    const { body } = await generate(2026, 3)
    const id = body.payments[0].id
    await api().put(`/api/rent-payments/${id}/payment`)
      .send({ receivedAmount: 850, paymentDate: '2026-03-02T00:00:00.000Z' }).expect(200)
    await api().delete(`/api/rent-payments/${id}`).expect(409)
    await api().delete(`/api/rent-payments/${id}/payment`).expect(200)
    await api().delete(`/api/rent-payments/${id}`).expect(204)
  })
})

describe('quittances', () => {
  async function paidPayment() {
    await setupLease()
    const { body } = await generate(2026, 3)
    const id = body.payments[0].id as string
    await api().put(`/api/rent-payments/${id}/payment`)
      .send({ receivedAmount: 850, paymentDate: '2026-03-02T00:00:00.000Z' }).expect(200)
    return id
  }

  it('refuse une quittance pour un loyer non soldé (409)', async () => {
    await setupLease()
    const { body } = await generate(2026, 3)
    const id = body.payments[0].id
    await api().put(`/api/rent-payments/${id}/payment`)
      .send({ receivedAmount: 100, paymentDate: '2026-03-02T00:00:00.000Z' }).expect(200)
    await setLandlordAddress()
    await api().post(`/api/rent-payments/${id}/receipt`).expect(409)
  })

  it('refuse une quittance sans adresse du bailleur (409)', async () => {
    const id = await paidPayment()
    const res = await api().post(`/api/rent-payments/${id}/receipt`).expect(409)
    expect(res.body.error).toMatch(/Adresse du bailleur/)
  })

  it('génère puis télécharge la quittance PDF', async () => {
    const id = await paidPayment()
    await setLandlordAddress()
    const created = await api().post(`/api/rent-payments/${id}/receipt`).expect(201)
    expect(created.body.filePath).toBe(`pdfs/quittances/2026/${id}.pdf`)

    const pdf = await api().get(`/api/rent-payments/${id}/receipt?download`)
      .buffer(true).parse((res, cb) => {
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => cb(null, Buffer.concat(chunks)))
      })
      .expect(200)
    expect(pdf.headers['content-type']).toBe('application/pdf')
    expect(pdf.headers['content-disposition']).toBe('attachment; filename="quittance-2026-03-Dupont.pdf"')
    expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-')

    const listed = await api().get('/api/rent-payments?year=2026&month=3').expect(200)
    expect(listed.body[0].receipt.id).toBe(created.body.id)
  })

  it('supprime la quittance quand le paiement est modifié', async () => {
    const id = await paidPayment()
    await setLandlordAddress()
    await api().post(`/api/rent-payments/${id}/receipt`).expect(201)
    await api().put(`/api/rent-payments/${id}/payment`)
      .send({ receivedAmount: 850, paymentDate: '2026-03-03T00:00:00.000Z' }).expect(200)
    await api().get(`/api/rent-payments/${id}/receipt`).expect(404)
  })
})
