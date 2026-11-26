import { createHash, randomBytes } from 'crypto'
import { BankAccount, Prisma } from '@prisma/client'
import { AppError } from '../middlewares/errorHandler'
import { EbAccount, EbTransaction, EnableBankingError, enableBanking, enableBankingConfigured } from '../lib/enableBanking'
import { normalizeText } from '../lib/bankCsv'
import { round2, toUtcDay } from '../lib/period'
import { bankRepository } from '../repositories/bank'
import { IncomingTransaction, presentAccount, storeTransactions } from './bank'

// Connexion automatique d'un compte (Enable Banking) : l'utilisateur donne son accord sur le site de sa banque,
// qui le renvoie vers l'adresse de retour avec un code ; le code ouvre une session (consentement de 180 jours au plus
// selon les banques) ; les opérations du compte choisi sont ensuite relevées à la demande et chaque jour.

const DAY_MS = 86_400_000
/** Profondeur de la première synchronisation sans opération déjà importée. */
const FIRST_SYNC_DAYS = 90
/** Recouvrement à chaque synchronisation : les opérations déjà reçues sont ignorées (même identifiant). */
const OVERLAP_DAYS = 10

async function accountOrThrow(id: string, userId: string) {
  const account = await bankRepository.findAccount(id, userId)
  if (!account) throw new AppError(404, 'Compte bancaire introuvable')
  return account
}

/** Les erreurs de l'agrégateur deviennent des erreurs lisibles (502 : la banque ou l'agrégateur a refusé). */
async function eb<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof EnableBankingError) throw new AppError(err.status === 503 ? 503 : 502, err.message)
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'TypeError')) {
      throw new AppError(502, `Enable Banking injoignable : ${err.message}`)
    }
    throw err
  }
}

const maskIban = (iban?: string | null) => (iban ? `${iban.slice(0, 4)} …${iban.slice(-4)}` : null)

export function accountLabel(a: EbAccount) {
  return [a.name || a.product || a.details || 'Compte', maskIban(a.account_id?.iban)].filter(Boolean).join(' · ')
}

/**
 * Opération de la banque → opération de l'application. Les opérations en attente (non comptabilisées) sont
 * écartées : leur identifiant et leur libellé changent souvent à la comptabilisation.
 */
export function toIncoming(list: EbTransaction[]): IncomingTransaction[] {
  const seen = new Map<string, number>()
  const out: IncomingTransaction[] = []
  for (const t of list) {
    if (t.status && t.status !== 'BOOK') continue
    const day = t.booking_date ?? t.value_date ?? t.transaction_date
    const value = Number(t.transaction_amount?.amount)
    if (!day || !Number.isFinite(value)) continue
    const date = new Date(`${day.slice(0, 10)}T00:00:00.000Z`)
    const amount = round2(t.credit_debit_indicator === 'DBIT' ? -Math.abs(value) : Math.abs(value))
    // Le nom de l'émetteur (crédit) ou du bénéficiaire (débit) aide au rapprochement
    const party = t.credit_debit_indicator === 'CRDT' ? t.debtor?.name : t.creditor?.name
    const parts = [...new Set([party, ...(t.remittance_information ?? [])].map((p) => (p ?? '').replace(/\s+/g, ' ').trim()).filter(Boolean))]
    const label = parts.join(' · ') || '(sans libellé)'
    let externalId: string
    const ref = t.entry_reference || t.transaction_id
    if (ref) {
      externalId = `eb:${ref}`
    } else {
      const key = `${date.toISOString().slice(0, 10)}|${amount.toFixed(2)}|${normalizeText(label)}`
      const rank = (seen.get(key) ?? 0) + 1
      seen.set(key, rank)
      externalId = `eb:${createHash('sha256').update(`${key}|${rank}`).digest('hex').slice(0, 32)}`
    }
    out.push({ externalId, amount, label, date })
  }
  return out
}

/** Relève les opérations du compte relié et les enregistre ; l'erreur éventuelle est gardée sur le compte. */
async function sync(account: BankAccount) {
  if (!account.ebAccountUid || !account.ebSessionId) throw new AppError(409, 'Ce compte n’est pas relié à la banque')
  let from: Date
  if (account.lastSyncAt) {
    from = new Date(toUtcDay(account.lastSyncAt).getTime() - OVERLAP_DAYS * DAY_MS)
  } else {
    // Première fois : à la suite des opérations déjà importées (relevé CSV), pour ne pas les recevoir en double
    const latest = (await bankRepository.latestTransactionDate(account.id))._max.date
    const floor = toUtcDay(new Date(Date.now() - FIRST_SYNC_DAYS * DAY_MS))
    from = latest ? new Date(Math.max(toUtcDay(latest).getTime() + DAY_MS, floor.getTime())) : floor
  }
  try {
    const list = await eb(() => enableBanking.transactions(account.ebAccountUid!, from))
    const result = await storeTransactions(account.id, account.userId, toIncoming(list))
    await bankRepository.setConnection(account.id, { lastSyncAt: new Date(), lastSyncError: null })
    return { ...result, since: from }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await bankRepository.setConnection(account.id, { lastSyncError: message.slice(0, 500) })
    throw err
  }
}

export const bankConnectionService = {
  /** Banques proposées (France, particuliers) ; configured = false si les clés Enable Banking manquent. */
  async banks() {
    if (!enableBankingConfigured()) return { configured: false, banks: [] }
    const list = await eb(() => enableBanking.banks('FR'))
    return { configured: true, banks: list.map((b) => ({ name: b.name, beta: !!b.beta })).sort((a, b) => a.name.localeCompare(b.name, 'fr')) }
  },

  /** Lance la connexion : renvoie l'adresse de la banque où donner son accord. */
  async start(accountId: string, userId: string, bankName: string) {
    await accountOrThrow(accountId, userId)
    const bank = (await eb(() => enableBanking.banks('FR'))).find((b) => b.name === bankName)
    if (!bank) throw new AppError(400, 'Banque inconnue')
    // Durée de consentement la plus longue que permet la banque (180 jours par défaut), moins une marge
    const seconds = Math.min(bank.maximum_consent_validity ?? 180 * 86_400, 180 * 86_400) - 3600
    const state = randomBytes(18).toString('base64url')
    const { url } = await eb(() => enableBanking.startAuth({ bankName, state, validUntil: new Date(Date.now() + seconds * 1000) }))
    await bankRepository.setConnection(accountId, { pendingState: state, pendingAccounts: Prisma.DbNull, bankName })
    return { url }
  },

  /**
   * Retour de la banque : l'adresse complète (copiée depuis le navigateur) ou ses paramètres. Ouvre la session ;
   * avec un seul compte autorisé, il est relié tout de suite, sinon l'utilisateur choisit.
   */
  async complete(accountId: string, userId: string, returnUrl: string) {
    const account = await accountOrThrow(accountId, userId)
    let params: URLSearchParams
    try {
      params = returnUrl.includes('?') ? new URL(returnUrl.trim(), 'https://retour.invalid').searchParams : new URLSearchParams(returnUrl.trim())
    } catch {
      throw new AppError(400, 'Adresse de retour illisible')
    }
    const error = params.get('error')
    if (error) throw new AppError(400, `La banque a refusé l’accès : ${params.get('error_description') ?? error}`)
    const code = params.get('code')
    const state = params.get('state')
    if (!code || !state) throw new AppError(400, 'Adresse de retour incomplète : il manque le code ou l’état (state)')
    if (!account.pendingState || state !== account.pendingState) {
      throw new AppError(409, 'Cette adresse de retour ne correspond pas à la connexion en cours : relancez « Connecter la banque »')
    }
    const session = await eb(() => enableBanking.createSession(code))
    if (!session.accounts?.length) {
      throw new AppError(409, 'La banque n’a autorisé aucun compte. En mode restreint, le compte doit aussi être relié dans le portail Enable Banking.')
    }
    // Une session précédente devient inutile
    if (account.ebSessionId && account.ebSessionId !== session.session_id) {
      await enableBanking.deleteSession(account.ebSessionId).catch(() => undefined)
    }
    const choices = session.accounts.map((a) => ({ uid: a.uid, label: accountLabel(a) }))
    const consentExpiresAt = session.access?.valid_until ? new Date(session.access.valid_until) : null
    const single = choices.length === 1 ? choices[0] : null
    const updated = await bankRepository.setConnection(accountId, {
      ebSessionId: session.session_id,
      consentExpiresAt,
      pendingState: null,
      ebAccountUid: single?.uid ?? null,
      remoteLabel: single?.label ?? null,
      pendingAccounts: single ? Prisma.DbNull : choices,
      lastSyncAt: null,
      lastSyncError: null,
    })
    if (single) await sync(updated).catch(() => undefined)
    return presentAccount((await bankRepository.findAccount(accountId, userId))!)
  },

  /** Choix du compte à la banque quand la session en propose plusieurs, puis première synchronisation. */
  async chooseAccount(accountId: string, userId: string, uid: string) {
    const account = await accountOrThrow(accountId, userId)
    const choices = (account.pendingAccounts as { uid: string; label: string }[] | null) ?? []
    const choice = choices.find((c) => c.uid === uid)
    if (!account.ebSessionId || !choice) throw new AppError(400, 'Compte inconnu pour cette connexion')
    const updated = await bankRepository.setConnection(accountId, {
      ebAccountUid: choice.uid, remoteLabel: choice.label, pendingAccounts: Prisma.DbNull, lastSyncAt: null, lastSyncError: null,
    })
    await sync(updated).catch(() => undefined)
    return presentAccount((await bankRepository.findAccount(accountId, userId))!)
  },

  async sync(accountId: string, userId: string) {
    return sync(await accountOrThrow(accountId, userId))
  },

  /** Coupe la connexion (le consentement est révoqué chez Enable Banking) ; les opérations reçues restent. */
  async disconnect(accountId: string, userId: string) {
    const account = await accountOrThrow(accountId, userId)
    if (account.ebSessionId) await enableBanking.deleteSession(account.ebSessionId).catch(() => undefined)
    const updated = await bankRepository.setConnection(accountId, {
      ebSessionId: null, ebAccountUid: null, remoteLabel: null, consentExpiresAt: null, pendingState: null,
      pendingAccounts: Prisma.DbNull, lastSyncError: null, bankName: null,
    })
    return presentAccount(updated)
  },

  /** Synchronise tous les comptes reliés (tâche quotidienne) ; une erreur sur un compte n'arrête pas les autres. */
  async syncAll() {
    const accounts = await bankRepository.findConnectedAccounts()
    const results: { accountId: string; imported?: number; error?: string }[] = []
    for (const a of accounts) {
      if (a.consentExpiresAt && a.consentExpiresAt < new Date()) {
        results.push({ accountId: a.id, error: 'consentement expiré' })
        continue
      }
      try {
        results.push({ accountId: a.id, imported: (await sync(a)).imported })
      } catch (err) {
        results.push({ accountId: a.id, error: err instanceof Error ? err.message : String(err) })
      }
    }
    return results
  },
}

/** Relève les comptes reliés peu après le démarrage puis toutes les 12 heures (BANK_SYNC=off pour couper). */
export function startBankSyncScheduler() {
  const run = () => bankConnectionService.syncAll().then((results) => {
    for (const r of results) {
      if (r.error) console.warn(`Synchro bancaire en échec (compte ${r.accountId}) : ${r.error}`)
      else if (r.imported) console.info(`Synchro bancaire : ${r.imported} opération(s) reçue(s) (compte ${r.accountId})`)
    }
  }).catch((err) => console.warn(`Synchro bancaire en échec : ${err instanceof Error ? err.message : err}`))
  setTimeout(run, 30_000)
  return setInterval(run, 12 * 3600_000)
}
