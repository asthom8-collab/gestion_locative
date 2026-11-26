import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'

// Le client Enable Banking est simulé : aucun appel réseau dans les tests
const eb = vi.hoisted(() => ({
  banks: vi.fn(),
  startAuth: vi.fn(),
  createSession: vi.fn(),
  deleteSession: vi.fn(),
  transactions: vi.fn(),
}))
vi.mock('../src/lib/enableBanking', async (orig) => ({
  ...(await orig<typeof import('../src/lib/enableBanking')>()),
  enableBankingConfigured: () => true,
  enableBanking: eb,
}))

import { api, resetDb, prisma, createProperty, createTenant, createLease } from './helpers'
import { toIncoming } from '../src/services/bankConnection'
import type { EbTransaction } from '../src/lib/enableBanking'

afterAll(() => prisma.$disconnect())

const ebTx = (over: Partial<EbTransaction> = {}): EbTransaction => ({
  entry_reference: 'REF1',
  transaction_amount: { amount: '850.00', currency: 'EUR' },
  credit_debit_indicator: 'CRDT',
  status: 'BOOK',
  booking_date: '2026-03-04',
  remittance_information: ['VIR SEPA LOYER MARS'],
  debtor: { name: 'M JEAN DUPONT' },
  ...over,
})

describe('opérations reçues de la banque', () => {
  it('signe les montants, compose le libellé et écarte les opérations en attente', () => {
    const rows = toIncoming([
      ebTx(),
      ebTx({ entry_reference: 'REF2', credit_debit_indicator: 'DBIT', transaction_amount: { amount: '32.10', currency: 'EUR' },
        creditor: { name: 'ASSUREUR' }, remittance_information: ['PRLV PNO'] }),
      ebTx({ entry_reference: 'REF3', status: 'PDNG' }),
    ])
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ externalId: 'eb:REF1', amount: 850, label: 'M JEAN DUPONT · VIR SEPA LOYER MARS' })
    expect(rows[0].date.toISOString()).toBe('2026-03-04T00:00:00.000Z')
    expect(rows[1]).toMatchObject({ amount: -32.1, label: 'ASSUREUR · PRLV PNO' })
  })

  it('donne un identifiant stable aux opérations sans référence', () => {
    const t = ebTx({ entry_reference: null, transaction_id: null })
    const [a, b] = toIncoming([t, t])
    expect(a.externalId).not.toBe(b.externalId)
    expect(toIncoming([t])[0].externalId).toBe(a.externalId)
  })
})

describe('/api/bank-accounts/:id/connect', () => {
  beforeEach(async () => {
    await resetDb()
    vi.clearAllMocks()
    eb.banks.mockResolvedValue([{ name: "Banque Exemple Mutualiste", country: 'FR', maximum_consent_validity: 15552000, beta: true }])
    eb.startAuth.mockResolvedValue({ url: 'https://banque.example/auth', authorization_id: 'auth1' })
    eb.createSession.mockResolvedValue({
      session_id: 'sess1',
      access: { valid_until: '2027-05-24T00:00:00.000Z' },
      accounts: [
        { uid: 'acc-courant', name: 'Compte de dépôt', account_id: { iban: 'FR7612345678901234567890123' } },
        { uid: 'acc-livret', name: 'Livret A', account_id: { iban: 'FR7699999999999999999999999' } },
      ],
    })
    eb.transactions.mockResolvedValue([ebTx()])
    eb.deleteSession.mockResolvedValue(null)
  })

  async function setup() {
    const p = await createProperty()
    const t = await createTenant()
    await createLease(p.id, t.id, { startDate: '2026-01-01T00:00:00.000Z' })
    // Bail suivi depuis janvier : la synchronisation complète ses échéances
    await api().post('/api/rent-payments/generate').send({ year: 2026, month: 1 }).expect(201)
    return (await api().post('/api/bank-accounts').send({ name: 'Compte commun' }).expect(201)).body as { id: string }
  }

  async function startAndReturn(accountId: string) {
    const start = await api().post(`/api/bank-accounts/${accountId}/connect`).send({ bankName: "Banque Exemple Mutualiste" }).expect(200)
    expect(start.body.url).toBe('https://banque.example/auth')
    const state = eb.startAuth.mock.calls[0][0].state as string
    return `https://localhost:5176/bank?state=${state}&code=code123`
  }

  it('liste les banques proposées', async () => {
    const res = await api().get('/api/bank-connection/banks').expect(200)
    expect(res.body).toEqual({ configured: true, banks: [{ name: "Banque Exemple Mutualiste", beta: true }] })
  })

  it('connecte le compte : accord à la banque, choix du compte, première synchronisation', async () => {
    const account = await setup()
    const returnUrl = await startAndReturn(account.id)
    // Consentement le plus long permis par la banque (180 jours), moins une marge
    const validUntil = eb.startAuth.mock.calls[0][0].validUntil as Date
    expect(validUntil.getTime() - Date.now()).toBeGreaterThan(179 * 86_400_000)

    await api().post(`/api/bank-accounts/${account.id}/connect/complete`).send({ returnUrl: returnUrl.replace(/state=[^&]+/, 'state=autre') }).expect(409)
    const done = await api().post(`/api/bank-accounts/${account.id}/connect/complete`).send({ returnUrl }).expect(200)
    expect(eb.createSession).toHaveBeenCalledWith('code123')
    expect(done.body).toMatchObject({ connected: false, accountChoices: [
      { uid: 'acc-courant', label: 'Compte de dépôt · FR76 …0123' }, { uid: 'acc-livret', label: 'Livret A · FR76 …9999' },
    ] })
    expect(done.body).not.toHaveProperty('ebSessionId')

    const chosen = await api().put(`/api/bank-accounts/${account.id}/connect/account`).send({ uid: 'acc-courant' }).expect(200)
    expect(chosen.body).toMatchObject({ connected: true, accountChoices: null, remoteLabel: 'Compte de dépôt · FR76 …0123', bankName: "Banque Exemple Mutualiste" })
    expect(chosen.body.lastSyncAt).not.toBeNull()
    expect(eb.transactions).toHaveBeenCalledWith('acc-courant', expect.any(Date))

    // L'encaissement reçu est proposé au rapprochement
    const [tx] = (await api().get('/api/bank-transactions').expect(200)).body
    expect(tx).toMatchObject({ amount: 850, label: 'M JEAN DUPONT · VIR SEPA LOYER MARS' })
    expect(tx.suggestions[0]).toMatchObject({ confidence: 'high' })

    // Synchroniser à nouveau ne crée pas de doublon
    const again = await api().post(`/api/bank-accounts/${account.id}/sync`).expect(200)
    expect(again.body).toMatchObject({ imported: 0, duplicates: 1 })
  })

  it('reprend à la suite du dernier relevé CSV importé', async () => {
    const account = await setup()
    await api().post(`/api/bank-accounts/${account.id}/import`).set('Content-Type', 'text/csv')
      .send(Buffer.from(`Date;Libellé;Montant\n${new Date(Date.now() - 20 * 86_400_000).toLocaleDateString('fr-FR')};VIR X;10,00\n`)).expect(201)
    eb.createSession.mockResolvedValueOnce({ session_id: 'sess1', accounts: [{ uid: 'acc-courant', name: 'Compte' }] })
    const returnUrl = await startAndReturn(account.id)
    const res = await api().post(`/api/bank-accounts/${account.id}/connect/complete`).send({ returnUrl }).expect(200)
    expect(res.body.connected).toBe(true)
    const from = eb.transactions.mock.calls[0][1] as Date
    const daysAgo = Math.round((Date.now() - from.getTime()) / 86_400_000)
    expect(daysAgo).toBeGreaterThanOrEqual(18)
    expect(daysAgo).toBeLessThanOrEqual(20)
  })

  it('rend lisible un refus de la banque et garde l’erreur de synchronisation', async () => {
    const account = await setup()
    await startAndReturn(account.id)
    await api().post(`/api/bank-accounts/${account.id}/connect/complete`)
      .send({ returnUrl: 'https://localhost:5176/bank?error=access_denied&error_description=Annul%C3%A9' }).expect(400)
      .then((r) => expect(r.body.error).toMatch(/Annulé/))

    eb.createSession.mockResolvedValueOnce({ session_id: 'sess1', accounts: [{ uid: 'acc-courant', name: 'Compte' }] })
    const { EnableBankingError } = await import('../src/lib/enableBanking')
    eb.transactions.mockRejectedValueOnce(new EnableBankingError(401, 'Enable Banking (401) : session expirée'))
    eb.startAuth.mockClear()
    const returnUrl = await startAndReturn(account.id)
    const res = await api().post(`/api/bank-accounts/${account.id}/connect/complete`).send({ returnUrl }).expect(200)
    expect(res.body).toMatchObject({ connected: true, lastSyncError: 'Enable Banking (401) : session expirée' })
    await api().post(`/api/bank-accounts/${account.id}/sync`).expect(200)
    const [listed] = (await api().get('/api/bank-accounts').expect(200)).body
    expect(listed.lastSyncError).toBeNull()
  })

  it('déconnecte en révoquant la session, sans supprimer les opérations', async () => {
    const account = await setup()
    eb.createSession.mockResolvedValueOnce({ session_id: 'sess1', accounts: [{ uid: 'acc-courant', name: 'Compte' }] })
    const returnUrl = await startAndReturn(account.id)
    await api().post(`/api/bank-accounts/${account.id}/connect/complete`).send({ returnUrl }).expect(200)
    const res = await api().delete(`/api/bank-accounts/${account.id}/connect`).expect(200)
    expect(res.body).toMatchObject({ connected: false, bankName: null })
    expect(eb.deleteSession).toHaveBeenCalledWith('sess1')
    expect(await prisma.bankTransaction.count()).toBe(1)
    await api().post(`/api/bank-accounts/${account.id}/sync`).expect(409)
  })
})
