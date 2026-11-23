import { prisma } from '../lib/prisma'
import { insee } from '../lib/insee'

export type IrlSyncResult = { checkedAt: Date; added: number; corrected: number; latest: { year: number; quarter: number } | null; error?: string }

// Résultat de la dernière vérification (en mémoire : refaite au démarrage de l'API)
let lastSync: IrlSyncResult | null = null

export const irlService = {
  lastSync: () => lastSync,

  /**
   * Importe les indices publiés par l'INSEE : ajoute les trimestres manquants et corrige une valeur saisie à la main
   * qui diffère de la valeur officielle. Ne lève pas d'erreur : l'échec est rendu dans le résultat.
   */
  async syncFromInsee(): Promise<IrlSyncResult> {
    const checkedAt = new Date()
    try {
      const rows = await insee.fetchIrl()
      let added = 0, corrected = 0
      for (const r of rows) {
        const existing = await prisma.irlIndex.findUnique({ where: { quarter_year: { quarter: r.quarter, year: r.year } } })
        if (!existing) added++
        else if (Math.abs(existing.value - r.value) >= 0.005) corrected++
        await prisma.irlIndex.upsert({
          where: { quarter_year: { quarter: r.quarter, year: r.year } },
          create: { quarter: r.quarter, year: r.year, value: r.value, source: 'INSEE', publishedAt: r.publishedAt },
          update: { value: r.value, source: 'INSEE', publishedAt: r.publishedAt },
        })
      }
      const latest = rows.reduce((a, b) => (b.year * 10 + b.quarter > a.year * 10 + a.quarter ? b : a))
      lastSync = { checkedAt, added, corrected, latest: { year: latest.year, quarter: latest.quarter } }
    } catch (e) {
      lastSync = { checkedAt, added: 0, corrected: 0, latest: null, error: e instanceof Error ? e.message : String(e) }
    }
    return lastSync
  },
}

/** Vérifie les indices INSEE au démarrage puis une fois par jour (pas dans les tests ; IRL_SYNC=off pour couper). */
export function startIrlScheduler() {
  const run = () => irlService.syncFromInsee().then((r) => {
    if (r.error) console.warn(`Import IRL INSEE en échec : ${r.error}`)
    else if (r.added || r.corrected) console.info(`IRL INSEE : ${r.added} ajouté(s), ${r.corrected} corrigé(s)`)
  })
  setTimeout(run, 15_000)
  return setInterval(run, 24 * 3600_000)
}
