import { toUtcDay, overlapDays, daysBetween } from './period'

/** Quote-part datée d'un propriétaire : startDate/endDate inclus, null = sans limite. */
export type DatedShare = { userId: string; share: number; startDate: Date | null; endDate: Date | null }

export const ownsAt = (o: Pick<DatedShare, 'startDate' | 'endDate'>, day: Date) => {
  const d = toUtcDay(day)
  return (!o.startDate || toUtcDay(o.startDate) <= d) && (!o.endDate || toUtcDay(o.endDate) >= d)
}

/** Propriétaires à une date donnée (dans l'ordre reçu). */
export function ownersAt<T extends Pick<DatedShare, 'startDate' | 'endDate'>>(ownerships: T[], day: Date): T[] {
  return ownerships.filter((o) => ownsAt(o, day))
}

/**
 * Cohérence d'une liste de quotes-parts datées : à chaque date où le bien est détenu, la somme fait 100 %,
 * et il y a au moins un propriétaire actuel. Renvoie le message d'erreur, ou null.
 */
export function checkTimeline(owners: DatedShare[]): string | null {
  for (const o of owners) {
    if (o.startDate && o.endDate && toUtcDay(o.endDate) < toUtcDay(o.startDate)) return 'Une date de fin précède la date de début'
  }
  if (!owners.some((o) => !o.endDate)) return 'Il faut au moins un propriétaire actuel (sans date de fin)'
  // Dates où la composition change : débuts, et lendemains de fins ; plus « depuis toujours » si un propriétaire n'a pas de début
  const points = new Set<number>()
  for (const o of owners) {
    if (o.startDate) points.add(toUtcDay(o.startDate).getTime())
    if (o.endDate) points.add(toUtcDay(o.endDate).getTime() + 86_400_000)
  }
  const checks: (Date | null)[] = [...points].sort((a, b) => a - b).map((t) => new Date(t))
  if (owners.some((o) => !o.startDate)) checks.unshift(null)
  const first = owners.every((o) => o.startDate) ? Math.min(...owners.map((o) => toUtcDay(o.startDate!).getTime())) : -Infinity
  for (const day of checks) {
    if (day && day.getTime() < first) continue
    const active = owners.filter((o) => (day ? ownsAt(o, day) : !o.startDate))
    const total = active.reduce((s, o) => s + o.share, 0)
    if (Math.abs(total - 1) > 0.0001) {
      const when = day ? `au ${day.toISOString().slice(0, 10).split('-').reverse().join('/')}` : 'au départ'
      return `La somme des quotes-parts doit faire 100 % ${when} (actuellement ${Math.round(total * 10000) / 100} %)`
    }
  }
  return null
}

/** Part d'un montant couvrant une période qui revient à chaque propriétaire : quote-part × jours détenus / jours de la période. */
export function allocate(amount: number, period: { start: Date; end: Date }, owners: DatedShare[]) {
  const days = daysBetween(period.start, period.end)
  return owners.map((o) => ({ userId: o.userId, amount: amount * o.share * overlapDays(period, o.startDate, o.endDate) / days }))
}
