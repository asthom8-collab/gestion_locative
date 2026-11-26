import { normalizeText } from './bankCsv'
import { daysBetween, round2 } from './period'

// Suggestions de rapprochement entre un encaissement bancaire et les échéances de loyer non rapprochées.
// L'application propose, l'utilisateur valide : rien n'est rapproché sans confirmation.

export type MatchCandidate = {
  id: string
  leaseId: string
  periodYear: number
  periodMonth: number
  expectedAmount: number
  receivedAmount: number | null
  dueDate: Date
  bankLabel: string | null
  tenantLastName: string
}

export type MatchSuggestion = {
  allocations: { rentPaymentId: string; amount: number }[]
  score: number
  /** « high » : montant et libellé concordent */
  confidence: 'high' | 'medium'
  reasons: string[]
}

/** Écart de date toléré entre l'opération et l'échéance, au-delà duquel une échéance n'est plus proposée. */
const MAX_DAYS = 75
const CLOSE_DAYS = 10
const MIN_SCORE = 40

const sameAmount = (a: number, b: number) => Math.abs(a - b) < 0.005

/** Le libellé de l'opération contient-il le libellé de rapprochement du bail, ou à défaut le nom du locataire ? */
function labelMatch(txLabel: string, c: MatchCandidate): { points: number; reason: string; byLeaseLabel: boolean } | null {
  const label = ` ${normalizeText(txLabel)} `
  const expected = c.bankLabel ? normalizeText(c.bankLabel) : ''
  if (expected && label.includes(` ${expected} `)) return { points: 45, reason: `Libellé « ${c.bankLabel} »`, byLeaseLabel: true }
  const name = normalizeText(c.tenantLastName)
  if (name.length >= 3 && label.includes(` ${name} `)) {
    return { points: 30, reason: `Nom « ${c.tenantLastName} » dans le libellé`, byLeaseLabel: false }
  }
  return null
}

function dateGap(txDate: Date, due: Date) {
  // daysBetween compte les deux bornes : 1 pour le même jour
  return due <= txDate ? daysBetween(due, txDate) - 1 : daysBetween(txDate, due) - 1
}

/** Une échéance proche rapporte des points ; une échéance bien plus tard que l'opération (loyer payé d'avance) en retire. */
function datePoints(txDate: Date, due: Date) {
  const gap = dateGap(txDate, due)
  if (gap <= CLOSE_DAYS) return { points: 15, reason: 'Date proche de l’échéance' }
  if (due > txDate) return { points: -10, reason: null }
  if (gap <= 35) return { points: 5, reason: null }
  return { points: 0, reason: null }
}

/**
 * Classe les échéances qui peuvent correspondre à l'encaissement : une échéance seule (montant exact, partiel),
 * ou plusieurs échéances consécutives d'un même bail réglées par un seul virement. Renvoie au plus `limit` suggestions.
 */
export function suggestMatches(
  tx: { amount: number; label: string; date: Date },
  candidates: MatchCandidate[],
  limit = 3
): MatchSuggestion[] {
  if (tx.amount <= 0) return []
  const out: (MatchSuggestion & { gap: number })[] = []
  const near = candidates.filter((c) => dateGap(tx.date, c.dueDate) <= MAX_DAYS)

  for (const c of near) {
    let score = 0
    const reasons: string[] = []
    let amount = Math.min(tx.amount, c.expectedAmount)
    if (sameAmount(tx.amount, c.expectedAmount)) {
      score += 50
      reasons.push('Montant exact')
    } else if (tx.amount < c.expectedAmount) {
      score += 10
      reasons.push(`Paiement partiel (${round2(tx.amount)} sur ${c.expectedAmount})`)
    } else {
      // Trop-perçu : on ne propose l'échéance que si le libellé de rapprochement du bail concorde
      amount = c.expectedAmount
    }
    const lbl = labelMatch(tx.label, c)
    if (lbl) { score += lbl.points; reasons.push(lbl.reason) }
    if (tx.amount > c.expectedAmount && !sameAmount(tx.amount, c.expectedAmount)) {
      if (!lbl?.byLeaseLabel) continue
      reasons.push(`Montant supérieur à l’échéance (${c.expectedAmount})`)
    }
    const gap = dateGap(tx.date, c.dueDate)
    const dp = datePoints(tx.date, c.dueDate)
    score += dp.points
    if (dp.reason) reasons.push(dp.reason)
    if (c.receivedAmount !== null) reasons.push('Paiement déjà saisi à la main : il sera remplacé')
    if (score < MIN_SCORE) continue
    out.push({
      allocations: [{ rentPaymentId: c.id, amount: round2(amount) }],
      score,
      // Sûr : montant exact, libellé reconnu et échéance proche (sinon, un autre mois du même bail peut aussi convenir)
      confidence: lbl && sameAmount(tx.amount, c.expectedAmount) && gap <= CLOSE_DAYS ? 'high' : 'medium',
      reasons,
      gap,
    })
  }

  // Virement groupé : 2 ou 3 échéances consécutives d'un même bail dont la somme fait le montant
  const byLease = new Map<string, MatchCandidate[]>()
  for (const c of near) byLease.set(c.leaseId, [...(byLease.get(c.leaseId) ?? []), c])
  for (const list of byLease.values()) {
    list.sort((a, b) => a.periodYear - b.periodYear || a.periodMonth - b.periodMonth)
    for (let size = 2; size <= 3; size++) {
      for (let i = 0; i + size <= list.length; i++) {
        const group = list.slice(i, i + size)
        const total = round2(group.reduce((s, c) => s + c.expectedAmount, 0))
        if (!sameAmount(total, tx.amount)) continue
        const lbl = labelMatch(tx.label, group[0])
        const gap = Math.min(...group.map((c) => dateGap(tx.date, c.dueDate)))
        // La dernière échéance du groupe compte : un virement groupé règle plutôt un arriéré qu'un loyer à venir
        const score = 40 + (lbl?.points ?? 0) + datePoints(tx.date, group[size - 1].dueDate).points
        const reasons = [`Montant égal à ${size} échéances`]
        if (lbl) reasons.push(lbl.reason)
        if (group.some((c) => c.receivedAmount !== null)) reasons.push('Paiement déjà saisi à la main : il sera remplacé')
        out.push({
          allocations: group.map((c) => ({ rentPaymentId: c.id, amount: c.expectedAmount })),
          score,
          confidence: 'medium',
          reasons,
          gap,
        })
      }
    }
  }

  return out
    .sort((a, b) => b.score - a.score || a.gap - b.gap)
    .slice(0, limit)
    .map(({ gap: _gap, ...s }) => s)
}
