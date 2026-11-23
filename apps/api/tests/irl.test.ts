import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import { api, resetDb, prisma } from './helpers'
import { insee, parseIrlSdmx } from '../src/lib/insee'

beforeEach(async () => {
  vi.restoreAllMocks()
  await resetDb()
})
afterAll(() => prisma.$disconnect())

// Extrait d'une vraie réponse de la BDM (série 001515333)
const SDMX = `<message:DataSet><Series IDBANK="001515333" FREQ="T" TITLE_FR="Indice de référence des loyers (IRL)">
<Obs TIME_PERIOD="2026-Q3" OBS_VALUE="148.06" OBS_STATUS="A" OBS_QUAL="DEF" OBS_TYPE="A" DATE_JO="2026-10-16"/>
<Obs TIME_PERIOD="2025-Q4" OBS_VALUE="145.78" OBS_STATUS="A" OBS_QUAL="DEF" OBS_TYPE="A" DATE_JO="2026-01-16"/>
</Series></message:DataSet>`

describe('import des indices IRL depuis l’INSEE', () => {
  it('lit les observations SDMX de la BDM', () => {
    expect(parseIrlSdmx(SDMX)).toEqual([
      { year: 2026, quarter: 3, value: 148.06, publishedAt: new Date('2026-10-16T00:00:00.000Z') },
      { year: 2025, quarter: 4, value: 145.78, publishedAt: new Date('2026-01-16T00:00:00.000Z') },
    ])
  })

  it('ajoute les trimestres manquants et corrige une saisie manuelle différente', async () => {
    vi.spyOn(insee, 'fetchIrl').mockResolvedValue(parseIrlSdmx(SDMX))
    await api().put('/api/irl').send({ quarter: 4, year: 2025, value: 145.7 }).expect(200)
    const r = (await api().post('/api/irl/sync').expect(200)).body
    expect(r).toMatchObject({ added: 1, corrected: 1, latest: { year: 2026, quarter: 3 } })
    const list = (await api().get('/api/irl').expect(200)).body
    expect(list).toMatchObject([
      { year: 2026, quarter: 3, value: 148.06, source: 'INSEE', publishedAt: '2026-10-16T00:00:00.000Z' },
      { year: 2025, quarter: 4, value: 145.78, source: 'INSEE' },
    ])
    expect((await api().get('/api/irl/sync').expect(200)).body).toMatchObject({ added: 1, corrected: 1 })
    // Une nouvelle saisie à la main repasse l'indice en « manuel »
    expect((await api().put('/api/irl').send({ quarter: 3, year: 2026, value: 148 }).expect(200)).body).toMatchObject({ source: 'MANUAL', publishedAt: null })
  })

  it('rend l’échec sans lever d’erreur (INSEE injoignable)', async () => {
    vi.spyOn(insee, 'fetchIrl').mockRejectedValue(new Error('INSEE : erreur 503'))
    expect((await api().post('/api/irl/sync').expect(200)).body).toMatchObject({ added: 0, error: 'INSEE : erreur 503' })
  })
})
