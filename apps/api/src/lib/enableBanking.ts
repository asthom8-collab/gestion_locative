import { readFileSync } from 'fs'
import { resolve } from 'path'
import { sign } from 'crypto'

// Client de l'API Enable Banking (agrégateur DSP2) : https://enablebanking.com/docs/api/reference/
// Chaque requête porte un jeton JWT signé (RS256) avec la clé privée de l'application ; l'identifiant de
// l'application sert de « kid ». Configuration dans apps/api/.env : ENABLE_BANKING_APP_ID, ENABLE_BANKING_KEY_PATH
// (clé privée PEM, jamais dans le dépôt), ENABLE_BANKING_REDIRECT_URL (adresse de retour déclarée chez Enable Banking).

const API = 'https://api.enablebanking.com'

export class EnableBankingError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'EnableBankingError'
  }
}

export const enableBankingConfigured = () =>
  !!(process.env.ENABLE_BANKING_APP_ID && process.env.ENABLE_BANKING_KEY_PATH && process.env.ENABLE_BANKING_REDIRECT_URL)

const b64url = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')

function token() {
  const appId = process.env.ENABLE_BANKING_APP_ID!
  const key = readFileSync(resolve(process.env.ENABLE_BANKING_KEY_PATH!))
  const now = Math.floor(Date.now() / 1000)
  const unsigned = `${b64url({ typ: 'JWT', alg: 'RS256', kid: appId })}.${b64url({ iss: 'enablebanking.com', aud: 'api.enablebanking.com', iat: now, exp: now + 600 })}`
  return `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), key).toString('base64url')}`
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (!enableBankingConfigured()) throw new EnableBankingError(503, 'Connexion bancaire non configurée (ENABLE_BANKING_* dans le .env de l’API)')
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  })
  const text = await res.text()
  let data: any = null
  try { data = text ? JSON.parse(text) : null } catch { /* réponse non JSON */ }
  if (!res.ok) {
    const detail = data?.message ?? data?.error?.message ?? data?.detail ?? text.slice(0, 200)
    throw new EnableBankingError(res.status, `Enable Banking (${res.status}) : ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`)
  }
  return data as T
}

export type EbAspsp = { name: string; country: string; maximum_consent_validity?: number; psu_types?: string[]; beta?: boolean }

export type EbAccount = {
  uid: string
  account_id?: { iban?: string | null } | null
  name?: string | null
  product?: string | null
  details?: string | null
  currency?: string | null
}

export type EbTransaction = {
  entry_reference?: string | null
  transaction_id?: string | null
  transaction_amount: { amount: string; currency: string }
  credit_debit_indicator: 'CRDT' | 'DBIT'
  status?: string | null
  booking_date?: string | null
  value_date?: string | null
  transaction_date?: string | null
  remittance_information?: string[] | null
  debtor?: { name?: string | null } | null
  creditor?: { name?: string | null } | null
}

export const enableBanking = {
  /** Banques d'un pays accessibles aux particuliers. */
  async banks(country = 'FR') {
    const r = await call<{ aspsps: EbAspsp[] }>('GET', `/aspsps?country=${country}&psu_type=personal`)
    return r.aspsps
  },

  /** Lance l'autorisation : renvoie l'adresse de la banque où l'utilisateur donne son accord. */
  startAuth(p: { bankName: string; country?: string; state: string; validUntil: Date }) {
    return call<{ url: string; authorization_id: string }>('POST', '/auth', {
      access: { valid_until: p.validUntil.toISOString() },
      aspsp: { name: p.bankName, country: p.country ?? 'FR' },
      state: p.state,
      redirect_url: process.env.ENABLE_BANKING_REDIRECT_URL,
      psu_type: 'personal',
    })
  },

  /** Échange le code reçu au retour de la banque contre une session (avec les comptes autorisés). */
  createSession(code: string) {
    return call<{ session_id: string; accounts: EbAccount[]; access?: { valid_until?: string } }>('POST', '/sessions', { code })
  },

  deleteSession(sessionId: string) {
    return call<unknown>('DELETE', `/sessions/${encodeURIComponent(sessionId)}`)
  },

  /** Opérations d'un compte depuis une date (toutes les pages). */
  async transactions(accountUid: string, dateFrom: Date) {
    const all: EbTransaction[] = []
    let key: string | undefined
    for (let page = 0; page < 50; page++) {
      const q = new URLSearchParams({ date_from: dateFrom.toISOString().slice(0, 10) })
      if (key) q.set('continuation_key', key)
      const r = await call<{ transactions: EbTransaction[]; continuation_key?: string | null }>(
        'GET', `/accounts/${encodeURIComponent(accountUid)}/transactions?${q}`)
      all.push(...(r.transactions ?? []))
      if (!r.continuation_key) break
      key = r.continuation_key
    }
    return all
  },
}
