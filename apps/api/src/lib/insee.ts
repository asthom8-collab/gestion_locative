/**
 * Indice de référence des loyers publié par l'INSEE : série 001515333 de la Banque de données macro-économiques,
 * en accès libre (SDMX, sans clé). Une observation par trimestre : TIME_PERIOD="2025-Q4", OBS_VALUE, DATE_JO.
 */
export const INSEE_IRL_URL = 'https://bdm.insee.fr/series/sdmx/data/SERIES_BDM/001515333'

export type InseeIrl = { year: number; quarter: number; value: number; publishedAt: Date | null }

/** Extrait les observations d'une réponse SDMX (XML) de la BDM. */
export function parseIrlSdmx(xml: string): InseeIrl[] {
  const rows: InseeIrl[] = []
  for (const [, attrs] of xml.matchAll(/<Obs\s([^>]*)\/?>/g)) {
    const attr = (name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(attrs)?.[1]
    const period = /^(\d{4})-Q([1-4])$/.exec(attr('TIME_PERIOD') ?? '')
    const value = Number(attr('OBS_VALUE'))
    if (!period || !(value > 0)) continue
    const jo = attr('DATE_JO')
    rows.push({ year: Number(period[1]), quarter: Number(period[2]), value, publishedAt: jo && /^\d{4}-\d{2}-\d{2}$/.test(jo) ? new Date(`${jo}T00:00:00.000Z`) : null })
  }
  return rows
}

/** Récupère les derniers indices (40 trimestres par défaut). Remplaçable dans les tests. */
export const insee = {
  async fetchIrl(last = 40): Promise<InseeIrl[]> {
    const res = await fetch(`${INSEE_IRL_URL}?lastNObservations=${last}`, { signal: AbortSignal.timeout(20_000) })
    if (!res.ok) throw new Error(`INSEE : erreur ${res.status}`)
    const rows = parseIrlSdmx(await res.text())
    if (!rows.length) throw new Error('INSEE : aucune valeur dans la réponse')
    return rows
  },
}
