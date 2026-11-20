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
  rentAmount: number
  chargesAmount: number
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
  const ratio = days / daysInMonth(year, month)
  const rentAmount = round2(lease.rentAmount * ratio)
  const chargesAmount = round2(lease.chargesAmount * ratio)
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
