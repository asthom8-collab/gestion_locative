import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { api, resetDb, prisma, createProperty, createTenant, createLease, createUser } from './helpers'
import { parseAmount, parseBankCsv, parseDate } from '../src/lib/bankCsv'
import { suggestMatches, MatchCandidate } from '../src/lib/bankMatching'

afterAll(() => prisma.$disconnect())

describe('lecture des relevés CSV', () => {
  it('lit les montants et les dates au format français', () => {
    expect(parseAmount('1 234,56')).toBe(1234.56)
    expect(parseAmount('-850,00 €')).toBe(-850)
    expect(parseAmount('+12.5')).toBe(12.5)
    expect(parseAmount('1,234.56')).toBe(1234.56)
    expect(parseAmount('')).toBeNull()
    expect(parseDate('05/03/2026')?.toISOString()).toBe('2026-03-05T00:00:00.000Z')
    expect(parseDate('2026-03-05')?.toISOString()).toBe('2026-03-05T00:00:00.000Z')
    expect(parseDate('05/03/26')?.toISOString()).toBe('2026-03-05T00:00:00.000Z')
    expect(parseDate('31/02/2026')).toBeNull()
  })

  it('repère l’en-tête après les lignes d’information, colonnes Débit et Crédit, Windows-1252', () => {
    const text = [
      'Compte courant n° XXXX',
      'Période du 01/03/2026 au 31/03/2026',
      '',
      'Date opération;Date valeur;Libellé;Débit;Crédit',
      '05/03/2026;05/03/2026;VIR SEPA DUPONT JEAN LOYER MARS;;850,00',
      '06/03/2026;06/03/2026;PRLV ASSURANCE PNO;32,10;',
    ].join('\r\n')
    const { rows, skipped } = parseBankCsv(Buffer.from(text, 'latin1'))
    expect(skipped).toEqual([])
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ amount: 850, label: 'VIR SEPA DUPONT JEAN LOYER MARS' })
    expect(rows[0].date.toISOString()).toBe('2026-03-05T00:00:00.000Z')
    expect(rows[1].amount).toBe(-32.1)
  })

  it('accepte une colonne Montant, des guillemets et des libellés sur plusieurs colonnes', () => {
    const text = 'Date;Libellé simplifié;Libellé opération;Montant\n"05/03/2026";"VIR DUPONT";"VIR SEPA DUPONT; LOYER";"850,00"\n'
    const { rows } = parseBankCsv(Buffer.from(text))
    expect(rows[0]).toMatchObject({ amount: 850, label: 'VIR DUPONT · VIR SEPA DUPONT; LOYER' })
  })

  it('donne le même identifiant à une même ligne, et des identifiants distincts aux opérations identiques', () => {
    const line = '05/03/2026;CB BOULANGERIE;-2,40'
    const a = parseBankCsv(Buffer.from(`Date;Libellé;Montant\n${line}\n${line}\n`)).rows
    const b = parseBankCsv(Buffer.from(`Date;Libellé;Montant\n${line}\n`)).rows
    expect(a[0].externalId).not.toBe(a[1].externalId)
    expect(b[0].externalId).toBe(a[0].externalId)
  })

  it('refuse un fichier sans colonnes reconnaissables', () => {
    expect(() => parseBankCsv(Buffer.from('a;b;c\n1;2;3\n'))).toThrow(/Format de relevé non reconnu/)
  })
})

describe('suggestions de rapprochement', () => {
  const candidate = (over: Partial<MatchCandidate> = {}): MatchCandidate => ({
    id: 'p3',
    leaseId: 'l1',
    periodYear: 2026,
    periodMonth: 3,
    expectedAmount: 850,
    receivedAmount: null,
    dueDate: new Date('2026-03-01T00:00:00.000Z'),
    bankLabel: null,
    tenantLastName: 'Dupont',
    ...over,
  })
  const tx = (amount: number, label = 'VIR SEPA DUPONT JEAN', date = '2026-03-04') => ({ amount, label, date: new Date(`${date}T00:00:00.000Z`) })

  it('propose avec une confiance haute quand le montant et le nom concordent', () => {
    const [s] = suggestMatches(tx(850), [candidate()])
    expect(s).toMatchObject({ confidence: 'high', allocations: [{ rentPaymentId: 'p3', amount: 850 }] })
    expect(s.reasons).toContain('Montant exact')
  })

  it('privilégie le libellé de rapprochement du bail et la date la plus proche', () => {
    const list = suggestMatches(tx(850, 'VIR SCI MARTIN LOYER'), [
      candidate({ id: 'autre', leaseId: 'l2', tenantLastName: 'Durand' }),
      candidate({ id: 'bon', bankLabel: 'SCI MARTIN' }),
    ])
    expect(list.map((s) => s.allocations[0].rentPaymentId)).toEqual(['bon', 'autre'])
  })

  it('propose un paiement partiel, et un virement groupé sur deux mois', () => {
    expect(suggestMatches(tx(400), [candidate()])[0]).toMatchObject({ allocations: [{ amount: 400 }], confidence: 'medium' })
    const grouped = suggestMatches(tx(1700, 'VIR DUPONT', '2026-04-03'), [
      candidate(),
      candidate({ id: 'p4', periodMonth: 4, dueDate: new Date('2026-04-01T00:00:00.000Z') }),
    ])
    expect(grouped[0].allocations.map((a) => a.rentPaymentId)).toEqual(['p3', 'p4'])
  })

  it('réserve la confiance haute à l’échéance proche, et préfère l’arriéré au loyer à venir', () => {
    const april = candidate({ id: 'p4', periodMonth: 4, dueDate: new Date('2026-04-01T00:00:00.000Z') })
    const may = candidate({ id: 'p5', periodMonth: 5, dueDate: new Date('2026-05-01T00:00:00.000Z') })
    const single = suggestMatches(tx(850, 'VIR DUPONT', '2026-04-03'), [candidate(), april])
    expect(single.map((s) => [s.allocations[0].rentPaymentId, s.confidence])).toEqual([['p4', 'high'], ['p3', 'medium']])
    const grouped = suggestMatches(tx(1700, 'VIR DUPONT', '2026-04-03'), [candidate(), april, may])
    expect(grouped[0].allocations.map((a) => a.rentPaymentId)).toEqual(['p3', 'p4'])
  })

  it('ne propose rien pour un débit, une échéance trop lointaine ou un montant sans rapport', () => {
    expect(suggestMatches(tx(-850), [candidate()])).toEqual([])
    expect(suggestMatches(tx(850, 'VIR DUPONT', '2026-09-01'), [candidate()])).toEqual([])
    expect(suggestMatches(tx(1200, 'VIR INCONNU'), [candidate()])).toEqual([])
  })
})

describe('/api/bank-accounts et /api/bank-transactions', () => {
  beforeEach(resetDb)

  const csv = (lines: string[]) => Buffer.from(['Date;Libellé;Montant', ...lines].join('\n'))

  async function setup() {
    const p = await createProperty()
    const t = await createTenant()
    const lease = await createLease(p.id, t.id, { startDate: '2026-01-01T00:00:00.000Z', rentAmount: 800, chargesAmount: 50 })
    // Bail suivi dans l'application à partir de mars 2026
    await api().post('/api/rent-payments/generate').send({ year: 2026, month: 3 }).expect(201)
    const account = (await api().post('/api/bank-accounts').send({ name: 'Compte commun' }).expect(201)).body
    return { lease, account }
  }

  const importCsv = (accountId: string, body: Buffer) =>
    api().post(`/api/bank-accounts/${accountId}/import`).set('Content-Type', 'text/csv').send(body)

  it('importe un relevé sans doublon et génère les échéances des mois concernés', async () => {
    const { account } = await setup()
    const body = csv(['04/03/2026;VIR SEPA DUPONT JEAN;850,00', '06/03/2026;PRLV ASSURANCE;-32,10'])
    const first = await importCsv(account.id, body).expect(201)
    expect(first.body).toMatchObject({ imported: 2, duplicates: 0 })
    const again = await importCsv(account.id, body).expect(201)
    expect(again.body).toMatchObject({ imported: 0, duplicates: 2 })
    expect(await prisma.rentPayment.count({ where: { periodYear: 2026, periodMonth: 3 } })).toBe(1)

    const accounts = (await api().get('/api/bank-accounts').expect(200)).body
    expect(accounts[0]).toMatchObject({ transactionCount: 2, toMatchCount: 1 })
  })

  it('ne génère d’échéances que pour les baux suivis, à partir de leur première échéance', async () => {
    const { account } = await setup()
    // Un second bail, jamais suivi dans l'application
    const p2 = await createProperty({ name: 'Studio' })
    const t2 = await createTenant({ lastName: 'Durand' })
    const other = await createLease(p2.id, t2.id, { startDate: '2026-01-01T00:00:00.000Z' })
    await importCsv(account.id, csv(['04/02/2026;VIR DUPONT;850,00', '04/04/2026;VIR DUPONT;850,00', '05/04/2026;VIR DURAND;600,00'])).expect(201)
    const payments = await prisma.rentPayment.findMany({ orderBy: { periodMonth: 'asc' } })
    expect(payments.map((p) => [p.leaseId === other.id ? 'autre' : 'suivi', p.periodMonth])).toEqual([['suivi', 3], ['suivi', 4]])
  })

  it('refuse un fichier illisible avec un message clair', async () => {
    const { account } = await setup()
    const res = await importCsv(account.id, Buffer.from('n’importe quoi')).expect(422)
    expect(res.body.error ?? res.body.message).toMatch(/Format de relevé non reconnu/)
  })

  it('propose l’échéance, rapproche à la validation, puis défait le rapprochement', async () => {
    const { account } = await setup()
    await importCsv(account.id, csv(['04/03/2026;VIR SEPA DUPONT JEAN;850,00'])).expect(201)

    const [tx] = (await api().get('/api/bank-transactions?status=UNMATCHED&direction=credit').expect(200)).body
    expect(tx.suggestions[0]).toMatchObject({ confidence: 'high' })
    const allocation = tx.suggestions[0].allocations[0]
    expect(allocation.payment).toMatchObject({ periodMonth: 3, lease: { tenant: { lastName: 'Dupont' } } })

    const matched = await api()
      .post(`/api/bank-transactions/${tx.id}/match`)
      .send({ allocations: [{ rentPaymentId: allocation.rentPaymentId, amount: 850 }] })
      .expect(200)
    expect(matched.body).toMatchObject({ status: 'MATCHED', rentPayments: [{ status: 'RECEIVED', receivedAmount: 850 }] })
    const payment = await prisma.rentPayment.findUniqueOrThrow({ where: { id: allocation.rentPaymentId } })
    expect(payment).toMatchObject({ source: 'BANK_MATCH', bankTransactionId: tx.id })
    expect(payment.paymentDate?.toISOString()).toBe('2026-03-04T00:00:00.000Z')

    // Un paiement venant de la banque ne se modifie ni ne s'annule à la main
    await api().put(`/api/rent-payments/${payment.id}/payment`).send({ receivedAmount: 10, paymentDate: '2026-03-04T00:00:00.000Z' }).expect(409)
    await api().delete(`/api/rent-payments/${payment.id}/payment`).expect(409)
    await api().delete(`/api/bank-accounts/${account.id}`).expect(409)

    const undone = await api().delete(`/api/bank-transactions/${tx.id}/match`).expect(200)
    expect(undone.body).toMatchObject({ status: 'UNMATCHED', rentPayments: [] })
    expect(await prisma.rentPayment.findUniqueOrThrow({ where: { id: payment.id } })).toMatchObject({
      status: 'PENDING', receivedAmount: null, bankTransactionId: null,
    })
  })

  it('répartit un virement sur deux échéances et refuse un total supérieur au virement', async () => {
    const { account } = await setup()
    await importCsv(account.id, csv(['03/04/2026;VIR DUPONT;1700,00'])).expect(201)
    await api().post('/api/rent-payments/generate').send({ year: 2026, month: 3 })
    const payments = (await api().get('/api/rent-payments').expect(200)).body as { id: string }[]
    expect(payments).toHaveLength(2)
    const [tx] = (await api().get('/api/bank-transactions').expect(200)).body
    expect(tx.suggestions[0].allocations).toHaveLength(2)

    await api().post(`/api/bank-transactions/${tx.id}/match`)
      .send({ allocations: payments.map((p) => ({ rentPaymentId: p.id, amount: 900 })) }).expect(400)
    const res = await api().post(`/api/bank-transactions/${tx.id}/match`)
      .send({ allocations: payments.map((p) => ({ rentPaymentId: p.id, amount: 850 })) }).expect(200)
    expect(res.body.rentPayments).toHaveLength(2)
  })

  it('ignore une opération puis la remet à rapprocher', async () => {
    const { account } = await setup()
    await importCsv(account.id, csv(['06/03/2026;VIR REMBOURSEMENT;20,00'])).expect(201)
    const [tx] = (await api().get('/api/bank-transactions').expect(200)).body
    await api().put(`/api/bank-transactions/${tx.id}/status`).send({ status: 'IGNORED' }).expect(200)
    expect((await api().get('/api/bank-transactions?status=UNMATCHED').expect(200)).body).toEqual([])
    await api().put(`/api/bank-transactions/${tx.id}/status`).send({ status: 'UNMATCHED' }).expect(200)
  })

  it('cloisonne les comptes et les échéances par utilisateur', async () => {
    const { account } = await setup()
    await importCsv(account.id, csv(['04/03/2026;VIR SEPA DUPONT JEAN;850,00'])).expect(201)
    const payment = await prisma.rentPayment.findFirstOrThrow()
    const other = await createUser()
    expect((await api(other.cookie).get('/api/bank-accounts').expect(200)).body).toEqual([])
    expect((await api(other.cookie).get('/api/bank-transactions').expect(200)).body).toEqual([])
    await importCsv(account.id, csv(['04/03/2026;X;1,00'])).set('Cookie', other.cookie).expect(404)

    // Son propre compte ne lui donne pas accès aux échéances des autres
    const mine = (await api(other.cookie).post('/api/bank-accounts').send({ name: 'Perso' }).expect(201)).body
    await api(other.cookie).post(`/api/bank-accounts/${mine.id}/import`).set('Content-Type', 'text/csv')
      .send(csv(['04/03/2026;VIR SEPA DUPONT JEAN;850,00'])).expect(201)
    const [tx] = (await api(other.cookie).get('/api/bank-transactions').expect(200)).body
    expect(tx.suggestions).toEqual([])
    await api(other.cookie).post(`/api/bank-transactions/${tx.id}/match`)
      .send({ allocations: [{ rentPaymentId: payment.id, amount: 850 }] }).expect(404)
  })

  it('enregistre le libellé de rapprochement du bail', async () => {
    const { lease } = await setup()
    const res = await api().patch(`/api/leases/${lease.id}`).send({ bankLabel: 'SCI MARTIN' }).expect(200)
    expect(res.body.bankLabel).toBe('SCI MARTIN')
    expect((await api().patch(`/api/leases/${lease.id}`).send({ bankLabel: '' }).expect(200)).body.bankLabel).toBeNull()
  })
})
