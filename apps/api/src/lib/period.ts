// Calculs de périodes mensuelles en UTC : les dates des baux sont des dates calendaires (minuit UTC)

const DAY_MS = 86_400_000

/** Date calendaire (minuit UTC) d'un Date quelconque. */
export function toUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function monthBounds(year: number, month: number) {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month - 1, daysInMonth(year, month))),
  }
}

export const round2 = (n: number) => Math.round(n * 100) / 100

export type LeaseTerms = {
  startDate: Date
  endDate: Date | null
  /** Loyer actuel (après la dernière révision) */
  rentAmount: number
  chargesAmount: number
  /** Révisions IRL du bail : avant effectiveDate, le loyer était previousRent */
  rentRevisions?: { effectiveDate: Date; previousRent: number }[]
}

/** Loyer en vigueur un jour donné, d'après l'historique des révisions. */
export function rentAt(lease: LeaseTerms, day: Date): number {
  const next = (lease.rentRevisions ?? [])
    .filter((r) => toUtcDay(r.effectiveDate) > day)
    .sort((a, b) => a.effectiveDate.getTime() - b.effectiveDate.getTime())[0]
  return next ? next.previousRent : lease.rentAmount
}

/**
 * Échéance d'un bail pour un mois donné, proratisée au jour si le bail commence
 * ou se termine dans le mois (date de fin incluse). Renvoie null si le bail ne couvre pas le mois.
 */
export function computeMonthlyDue(lease: LeaseTerms, year: number, month: number) {
  const { start: monthStart, end: monthEnd } = monthBounds(year, month)
  const leaseStart = toUtcDay(lease.startDate)
  const leaseEnd = lease.endDate ? toUtcDay(lease.endDate) : null

  const periodStart = leaseStart > monthStart ? leaseStart : monthStart
  const periodEnd = leaseEnd && leaseEnd < monthEnd ? leaseEnd : monthEnd
  if (periodStart > periodEnd) return null

  const days = Math.round((periodEnd.getTime() - periodStart.getTime()) / DAY_MS) + 1
  const dim = daysInMonth(year, month)
  // Loyer jour par jour : une révision qui prend effet en cours de mois est proratisée
  let rentSum = 0
  for (let i = 0; i < days; i++) rentSum += rentAt(lease, new Date(periodStart.getTime() + i * DAY_MS))
  const rentAmount = round2(rentSum / dim)
  const chargesAmount = round2(lease.chargesAmount * days / dim)
  return {
    periodStart,
    periodEnd,
    rentAmount,
    chargesAmount,
    expectedAmount: round2(rentAmount + chargesAmount),
  }
}

/** Date d'exigibilité : le jour de paiement du bail, ou le début de période s'il est plus tardif. */
export function dueDate(periodStart: Date, year: number, month: number, rentDayOfMonth: number): Date {
  const due = new Date(Date.UTC(year, month - 1, rentDayOfMonth))
  return due > periodStart ? due : periodStart
}

/** Nombre de jours (bornes incluses) entre deux dates calendaires. */
export function daysBetween(start: Date, end: Date): number {
  return Math.round((toUtcDay(end).getTime() - toUtcDay(start).getTime()) / DAY_MS) + 1
}

/** Même jour un an plus tard (le 29 février devient le 28 février). */
export function addOneYear(d: Date): Date {
  const y = d.getUTCFullYear() + 1, m = d.getUTCMonth()
  return new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), daysInMonth(y, m + 1))))
}

/** Jours d'un bail compris dans une année civile (0 si le bail ne la couvre pas). */
export function occupiedDaysInYear(lease: { startDate: Date; endDate: Date | null }, year: number): number {
  const yStart = new Date(Date.UTC(year, 0, 1)), yEnd = new Date(Date.UTC(year, 11, 31))
  const s = toUtcDay(lease.startDate) > yStart ? toUtcDay(lease.startDate) : yStart
  const e = lease.endDate && toUtcDay(lease.endDate) < yEnd ? toUtcDay(lease.endDate) : yEnd
  return s > e ? 0 : daysBetween(s, e)
}

export const daysInYear = (year: number) => daysBetween(new Date(Date.UTC(year, 0, 1)), new Date(Date.UTC(year, 11, 31)))
