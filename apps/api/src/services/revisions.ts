import { AppError } from '../middlewares/errorHandler'
import { prisma } from '../lib/prisma'
import { addOneYear, computeMonthlyDue, round2, toUtcDay } from '../lib/period'
import { day as fmtDay } from '../lib/pdfCommon'
import { renderRevisionLetterPdf } from '../lib/lettersPdf'
import { irlRepository } from '../repositories/irl'
import { LeaseForDocuments } from '../repositories/charges'
import { leaseOrThrow } from './charges'
import { landlordsFor } from './landlords'

/**
 * Dernière année publiée d'un trimestre IRL à une date donnée. L'INSEE publie vers le 15 du mois qui suit
 * le trimestre (T1 mi-avril, T2 mi-juillet, T3 mi-octobre, T4 mi-janvier de l'année suivante) : approximation.
 */
export function lastPublishedYear(quarter: number, date: Date): number {
  const y = date.getUTCFullYear()
  const published = (year: number) => (quarter < 4 ? new Date(Date.UTC(year, 3 * quarter, 15)) : new Date(Date.UTC(year + 1, 0, 15)))
  return published(y) <= date ? y : published(y - 1) <= date ? y - 1 : y - 2
}

/**
 * Proposition de révision : date (anniversaire du bail ou de la dernière révision), indice de référence,
 * nouvel indice (le plus récent du même trimestre) et loyer calculé. `missing` dit ce qui manque pour réviser.
 */
export async function computeRevision(lease: LeaseForDocuments, date?: Date) {
  const last = lease.rentRevisions[lease.rentRevisions.length - 1]
  const nextRevisionDate = addOneYear(toUtcDay(last ? last.effectiveDate : lease.startDate))
  // Date d'effet : celle demandée, sinon l'anniversaire (ou aujourd'hui si l'anniversaire est passé, la révision n'étant pas rétroactive)
  const today = toUtcDay(new Date())
  const effectiveDate = date ? toUtcDay(date) : nextRevisionDate > today ? nextRevisionDate : today
  const base = { leaseId: lease.id, currentRent: lease.rentAmount, nextRevisionDate, effectiveDate, lastRevisionDate: last?.effectiveDate ?? null }
  if (lease.irlReference == null || lease.irlQuarter == null || lease.irlYear == null) {
    return { ...base, missing: 'REFERENCE' as const, reference: null, newIndex: null, expectedIndex: null, computedRent: null }
  }
  const reference = { value: lease.irlReference, quarter: lease.irlQuarter, year: lease.irlYear }
  const maxYear = lastPublishedYear(lease.irlQuarter, effectiveDate)
  const expectedIndex = { quarter: lease.irlQuarter, year: Math.max(maxYear, lease.irlYear + 1) }
  const idx = await irlRepository.latestBetween(lease.irlQuarter, lease.irlYear, maxYear)
  if (!idx) return { ...base, missing: 'INDEX' as const, reference, newIndex: null, expectedIndex, computedRent: null }
  return {
    ...base,
    missing: null,
    reference,
    expectedIndex,
    newIndex: { value: idx.value, quarter: idx.quarter, year: idx.year },
    computedRent: round2(lease.rentAmount * idx.value / lease.irlReference),
  }
}

/** Recalcule les échéances pas encore payées touchées par un changement de loyer. */
async function recomputePending(leaseId: string, from: Date) {
  const lease = await prisma.lease.findUniqueOrThrow({ where: { id: leaseId }, include: { rentRevisions: true } })
  const pending = await prisma.rentPayment.findMany({ where: { leaseId, receivedAmount: null, periodEnd: { gte: from } } })
  for (const p of pending) {
    const due = computeMonthlyDue(lease, p.periodYear, p.periodMonth)
    if (due) await prisma.rentPayment.update({ where: { id: p.id }, data: { rentAmount: due.rentAmount, chargesAmount: due.chargesAmount, expectedAmount: due.expectedAmount } })
  }
}

export const revisionsService = {
  async list(leaseId: string, userId: string) {
    const lease = await leaseOrThrow(leaseId, userId)
    return [...lease.rentRevisions].reverse()
  },

  async preview(leaseId: string, userId: string, date?: Date) {
    return computeRevision(await leaseOrThrow(leaseId, userId), date)
  },

  async apply(leaseId: string, userId: string, input: { effectiveDate: Date; newRent?: number }) {
    const lease = await leaseOrThrow(leaseId, userId)
    if (!lease.active) throw new AppError(409, 'Ce bail est terminé')
    const p = await computeRevision(lease, input.effectiveDate)
    const effectiveDate = p.effectiveDate
    if (effectiveDate < p.nextRevisionDate) {
      throw new AppError(400, `Une révision par an au plus : pas avant le ${fmtDay(p.nextRevisionDate)}`)
    }
    if (p.missing === 'REFERENCE') throw new AppError(409, 'Renseignez l’IRL de référence du bail (valeur, trimestre et année)')
    if (p.missing === 'INDEX') throw new AppError(409, `Indice IRL du T${p.expectedIndex!.quarter} ${p.expectedIndex!.year} manquant : non saisi ou pas encore publié à cette date`)
    const newRent = round2(input.newRent ?? p.computedRent!)
    if (newRent > p.computedRent! + 0.001) {
      throw new AppError(400, `Le loyer révisé ne peut pas dépasser ${p.computedRent} € (variation de l’IRL)`)
    }
    const revision = await prisma.$transaction(async (tx) => {
      const r = await tx.rentRevision.create({
        data: {
          leaseId, effectiveDate, previousRent: lease.rentAmount, newRent,
          previousIrlValue: p.reference!.value, previousIrlQuarter: p.reference!.quarter, previousIrlYear: p.reference!.year,
          newIrlValue: p.newIndex!.value, newIrlYear: p.newIndex!.year,
        },
      })
      await tx.lease.update({ where: { id: leaseId }, data: { rentAmount: newRent, irlReference: p.newIndex!.value, irlYear: p.newIndex!.year } })
      return r
    })
    await recomputePending(leaseId, effectiveDate)
    return revision
  },

  /** Annule la dernière révision : loyer et IRL de référence reviennent à leurs valeurs précédentes. */
  async cancel(leaseId: string, id: string, userId: string) {
    const lease = await leaseOrThrow(leaseId, userId)
    const last = lease.rentRevisions[lease.rentRevisions.length - 1]
    if (!last || last.id !== id) {
      throw new AppError(lease.rentRevisions.some((r) => r.id === id) ? 409 : 404,
        lease.rentRevisions.some((r) => r.id === id) ? 'Seule la dernière révision peut être annulée' : 'Révision introuvable')
    }
    await prisma.$transaction([
      prisma.rentRevision.delete({ where: { id } }),
      prisma.lease.update({ where: { id: leaseId }, data: { rentAmount: last.previousRent, irlReference: last.previousIrlValue, irlQuarter: last.previousIrlQuarter, irlYear: last.previousIrlYear } }),
    ])
    await recomputePending(leaseId, last.effectiveDate)
  },

  async letter(leaseId: string, id: string, userId: string) {
    const lease = await leaseOrThrow(leaseId, userId)
    const r = lease.rentRevisions.find((x) => x.id === id)
    if (!r) throw new AppError(404, 'Révision introuvable')
    const pdf = await renderRevisionLetterPdf({
      landlords: await landlordsFor(lease.property.ownerships, r.effectiveDate),
      tenantName: `${lease.tenant.firstName} ${lease.tenant.lastName}`,
      property: lease.property,
      effectiveDate: r.effectiveDate,
      previousRent: r.previousRent,
      newRent: r.newRent,
      chargesAmount: lease.chargesAmount,
      quarter: r.previousIrlQuarter,
      previousIrl: { value: r.previousIrlValue, year: r.previousIrlYear },
      newIrl: { value: r.newIrlValue, year: r.newIrlYear },
      issuedAt: new Date(),
    })
    const y = r.effectiveDate.getUTCFullYear()
    return { pdf, fileName: `revision-loyer-${y}-${lease.tenant.lastName.normalize('NFD').replace(/[^A-Za-z0-9-]/g, '')}.pdf` }
  },
}
