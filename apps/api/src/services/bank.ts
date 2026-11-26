import { BankAccount, PaymentStatus } from '@prisma/client'
import { AppError } from '../middlewares/errorHandler'
import { BankCsvError, parseBankCsv } from '../lib/bankCsv'
import { MatchCandidate, suggestMatches } from '../lib/bankMatching'
import { dueDate, round2, toUtcDay } from '../lib/period'
import { removeFile } from '../lib/storage'
import { enableBanking } from '../lib/enableBanking'
import { TransactionFilter, TransactionWithPayments, bankRepository } from '../repositories/bank'
import { rentPaymentsService } from './rentPayments'

export const MAX_STATEMENT_BYTES = 5 * 1024 * 1024
const DAY_MS = 86_400_000

async function accountOrThrow(id: string, userId: string) {
  const account = await bankRepository.findAccount(id, userId)
  if (!account) throw new AppError(404, 'Compte bancaire introuvable')
  return account
}

async function transactionOrThrow(id: string, userId: string) {
  const tx = await bankRepository.findTransaction(id, userId)
  if (!tx) throw new AppError(404, 'Opération introuvable')
  return tx
}

type Candidates = { candidates: MatchCandidate[]; details: Map<string, unknown> }

/**
 * Échéances candidates au rapprochement autour des dates des opérations : au format du moteur de suggestions,
 * et leur résumé (bien, locataire, mois) pour l'affichage.
 */
async function loadCandidates(userId: string, dates: Date[]): Promise<Candidates> {
  if (!dates.length) return { candidates: [], details: new Map() }
  const min = Math.min(...dates.map((d) => d.getTime()))
  const max = Math.max(...dates.map((d) => d.getTime()))
  const payments = await bankRepository.findCandidatePayments(userId, new Date(min - 100 * DAY_MS), new Date(max + 100 * DAY_MS))
  const today = toUtcDay(new Date())
  const candidates: MatchCandidate[] = []
  const details = new Map<string, unknown>()
  for (const p of payments) {
    const due = dueDate(p.periodStart, p.periodYear, p.periodMonth, p.lease.rentDayOfMonth)
    candidates.push({
      id: p.id,
      leaseId: p.leaseId,
      periodYear: p.periodYear,
      periodMonth: p.periodMonth,
      expectedAmount: p.expectedAmount,
      receivedAmount: p.receivedAmount,
      dueDate: due,
      bankLabel: p.lease.bankLabel,
      tenantLastName: p.lease.tenant.lastName,
    })
    details.set(p.id, {
      id: p.id,
      periodYear: p.periodYear,
      periodMonth: p.periodMonth,
      expectedAmount: p.expectedAmount,
      receivedAmount: p.receivedAmount,
      status: p.status === 'PENDING' && due < today ? 'LATE' : p.status,
      dueDate: due,
      lease: { id: p.lease.id, property: p.lease.property, tenant: p.lease.tenant },
    })
  }
  return { candidates, details }
}

/** Ajoute aux encaissements à rapprocher les suggestions, avec le résumé des échéances proposées. */
function withSuggestions(txs: TransactionWithPayments[], { candidates, details }: Candidates) {
  return txs.map((tx) => ({
    ...tx,
    suggestions:
      tx.status === 'UNMATCHED' && tx.amount > 0
        ? suggestMatches(tx, candidates).map((s) => ({
            ...s,
            allocations: s.allocations.map((a) => ({ ...a, payment: details.get(a.rentPaymentId) })),
          }))
        : [],
  }))
}

export type IncomingTransaction = { externalId: string; amount: number; label: string; date: Date }

/**
 * Enregistre des opérations dans un compte (celles déjà présentes, même identifiant, sont ignorées) et génère au
 * besoin les échéances de loyer des mois des encaissements (jusqu'au mois en cours), pour les proposer au rapprochement :
 * seulement pour les baux déjà suivis, à partir de leur première échéance.
 * Sert à l'import CSV comme à la synchronisation avec la banque.
 */
export async function storeTransactions(accountId: string, userId: string, rows: IncomingTransaction[]) {
  const { count } = rows.length
    ? await bankRepository.createTransactions(rows.map((r) => ({ accountId, ...r })))
    : { count: 0 }
  const today = toUtcDay(new Date())
  const months = new Set(
    rows.filter((r) => r.amount > 0 && r.date <= today).map((r) => `${r.date.getUTCFullYear()}-${r.date.getUTCMonth() + 1}`)
  )
  for (const m of months) {
    const [year, month] = m.split('-').map(Number)
    await rentPaymentsService.generate(userId, year, month, { trackedOnly: true })
  }
  const dates = rows.map((r) => r.date.getTime())
  return {
    imported: count,
    duplicates: rows.length - count,
    from: dates.length ? new Date(Math.min(...dates)) : null,
    to: dates.length ? new Date(Math.max(...dates)) : null,
  }
}

/** Compte tel que le voit le front : sans les identifiants de session ni l'état de la connexion en cours. */
export function presentAccount(a: BankAccount) {
  const { ebSessionId, ebAccountUid, pendingState, pendingAccounts, ...rest } = a
  return {
    ...rest,
    connected: !!(ebSessionId && ebAccountUid),
    connectionPending: !!pendingState,
    // Comptes proposés par la banque, en attente du choix de l'utilisateur
    accountChoices: (pendingAccounts as { uid: string; label: string }[] | null) ?? null,
  }
}

export const bankService = {
  async listAccounts(userId: string) {
    const accounts = await bankRepository.findAccounts(userId)
    const [byStatus, last, toMatch] = await bankRepository.accountStats(accounts.map((a) => a.id))
    return accounts.map((a) => ({
      ...presentAccount(a),
      transactionCount: byStatus.filter((s) => s.accountId === a.id).reduce((n, s) => n + s._count, 0),
      toMatchCount: toMatch.find((s) => s.accountId === a.id)?._count ?? 0,
      lastTransactionDate: last.find((s) => s.accountId === a.id)?._max.date ?? null,
    }))
  },

  async createAccount(userId: string, name: string) {
    return presentAccount(await bankRepository.createAccount(userId, name))
  },

  async updateAccount(id: string, userId: string, name: string) {
    await accountOrThrow(id, userId)
    return presentAccount(await bankRepository.updateAccount(id, name))
  },

  async deleteAccount(id: string, userId: string) {
    const account = await accountOrThrow(id, userId)
    if (await bankRepository.countMatched(id)) {
      throw new AppError(409, 'Des opérations de ce compte sont rapprochées de loyers : défaites ces rapprochements avant de supprimer le compte')
    }
    if (account.ebSessionId) await enableBanking.deleteSession(account.ebSessionId).catch(() => undefined)
    await bankRepository.deleteAccount(id)
  },

  /**
   * Importe un relevé CSV dans le compte. Les opérations déjà importées sont ignorées ; les échéances de loyer
   * des mois concernés sont générées au besoin (baux déjà suivis), pour pouvoir être proposées au rapprochement.
   */
  async importCsv(accountId: string, userId: string, content: Buffer) {
    await accountOrThrow(accountId, userId)
    if (!content.length) throw new AppError(400, 'Fichier vide')
    let parsed
    try {
      parsed = parseBankCsv(content)
    } catch (err) {
      if (err instanceof BankCsvError) throw new AppError(422, err.message)
      throw err
    }
    if (!parsed.rows.length) throw new AppError(422, 'Aucune opération lisible dans ce fichier')
    return { ...(await storeTransactions(accountId, userId, parsed.rows)), skipped: parsed.skipped }
  },

  async listTransactions(filter: TransactionFilter) {
    const txs = await bankRepository.findTransactions(filter)
    const open = txs.filter((t) => t.status === 'UNMATCHED' && t.amount > 0)
    return withSuggestions(txs, await loadCandidates(filter.userId, open.map((t) => t.date)))
  },

  /** Rapproche un encaissement d'une ou plusieurs échéances (montant affecté à chacune). */
  async match(id: string, userId: string, allocations: { rentPaymentId: string; amount: number }[]) {
    const tx = await transactionOrThrow(id, userId)
    if (tx.status !== 'UNMATCHED') throw new AppError(409, 'Cette opération est déjà rapprochée ou ignorée')
    if (tx.amount <= 0) throw new AppError(409, 'Seul un encaissement peut régler un loyer')
    const ids = allocations.map((a) => a.rentPaymentId)
    if (new Set(ids).size !== ids.length) throw new AppError(400, 'Une échéance figure deux fois')
    const total = round2(allocations.reduce((s, a) => s + a.amount, 0))
    if (total > tx.amount + 0.005) {
      throw new AppError(400, `Le total affecté (${total}) dépasse le montant de l’opération (${tx.amount})`)
    }
    const payments = await bankRepository.findPaymentsForMatch(ids, userId)
    if (payments.length !== ids.length) throw new AppError(404, 'Échéance introuvable')
    if (payments.some((p) => p.bankTransactionId)) throw new AppError(409, 'Une échéance est déjà rapprochée d’une autre opération')

    const updates = allocations.map((a) => {
      const p = payments.find((x) => x.id === a.rentPaymentId)!
      const amount = round2(a.amount)
      const status: PaymentStatus = amount >= p.expectedAmount - 0.005 ? 'RECEIVED' : 'PARTIAL'
      return {
        id: p.id,
        data: { receivedAmount: amount, paymentDate: tx.date, status, source: 'BANK_MATCH' as const, bankTransactionId: tx.id },
      }
    })
    // Une quittance existante ne vaut plus si le montant ou la date changent
    const stale = payments.filter((p) => {
      const u = updates.find((x) => x.id === p.id)!.data
      return p.receipt && (p.receivedAmount !== u.receivedAmount || p.paymentDate?.getTime() !== tx.date.getTime())
    })
    await bankRepository.applyMatch(tx.id, updates, stale.map((p) => p.id))
    for (const p of stale) await removeFile(p.receipt!.filePath)
    return transactionOrThrow(id, userId)
  },

  /** Défait un rapprochement : les échéances repassent en attente et leurs quittances sont supprimées. */
  async unmatch(id: string, userId: string) {
    const tx = await transactionOrThrow(id, userId)
    if (tx.status !== 'MATCHED') throw new AppError(409, 'Cette opération n’est pas rapprochée')
    const paymentIds = tx.rentPayments.map((p) => p.id)
    const receipts = await bankRepository.findReceipts(paymentIds)
    await bankRepository.undoMatch(tx.id, paymentIds)
    for (const r of receipts) await removeFile(r.filePath)
    return transactionOrThrow(id, userId)
  },

  /** Ignore une opération (virement sans rapport avec un loyer), ou la remet à rapprocher. */
  async setStatus(id: string, userId: string, status: 'IGNORED' | 'UNMATCHED') {
    const tx = await transactionOrThrow(id, userId)
    if (tx.status === 'MATCHED') throw new AppError(409, 'Défaites d’abord le rapprochement')
    await bankRepository.setStatus(id, status)
    return transactionOrThrow(id, userId)
  },
}
