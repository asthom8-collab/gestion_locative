import type { FiscalRegime, PropertyType } from '../types'

export const eur = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)

/** Date longue (« 01 janvier 2026 »). Les dates de l'API sont à minuit UTC : on les affiche en UTC. */
export const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '—'

/** Mois court (« janv. 2026 »), pour les historiques. */
export const fmtMonth = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric', timeZone: 'UTC' }) : '?'

export const fullName = (p?: { firstName: string; lastName: string } | null) => (p ? `${p.firstName} ${p.lastName}` : '—')

export const initials = (p?: { firstName?: string; lastName?: string } | null) =>
  `${p?.firstName?.[0] ?? ''}${p?.lastName?.[0] ?? ''}`.toUpperCase()

/** Durée entre deux dates (« < 1 mois », « 8 mois », « 3 ans »), comme dans la maquette. */
export function durationLabel(startIso: string, endIso?: string | null) {
  const start = new Date(startIso)
  const end = endIso ? new Date(endIso) : new Date()
  const months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth())
  if (months < 1) return '< 1 mois'
  if (months < 24) return `${months} mois`
  return `${Math.floor(months / 12)} ans`
}

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  APARTMENT: 'Appartement', HOUSE: 'Maison', PARKING: 'Parking', COMMERCIAL: 'Local commercial',
}

export const FISCAL_REGIMES: Record<FiscalRegime, { label: string; badge?: string; color?: string }> = {
  NU: { label: 'Location nue' },
  PINEL: { label: 'Pinel', badge: 'Pinel', color: 'bg-violet-50 text-violet-700 border border-violet-200' },
  LMNP_MICRO: { label: 'LMNP micro-BIC', badge: 'LMNP micro', color: 'bg-teal-50 text-teal-700 border border-teal-200' },
  LMNP_REEL: { label: 'LMNP réel', badge: 'LMNP réel', color: 'bg-teal-50 text-teal-700 border border-teal-200' },
}
