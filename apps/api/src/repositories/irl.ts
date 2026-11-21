import { prisma } from '../lib/prisma'

export const irlRepository = {
  findAll() {
    return prisma.irlIndex.findMany({ orderBy: [{ year: 'desc' }, { quarter: 'desc' }] })
  },
  find(quarter: number, year: number) {
    return prisma.irlIndex.findUnique({ where: { quarter_year: { quarter, year } } })
  },
  /** Indice le plus récent d'un trimestre entre deux années (minYear exclue, maxYear incluse). */
  latestBetween(quarter: number, minYear: number, maxYear: number) {
    return prisma.irlIndex.findFirst({ where: { quarter, year: { gt: minYear, lte: maxYear } }, orderBy: { year: 'desc' } })
  },
  upsert(quarter: number, year: number, value: number) {
    return prisma.irlIndex.upsert({
      where: { quarter_year: { quarter, year } },
      create: { quarter, year, value },
      update: { value },
    })
  },
}
