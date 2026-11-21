import { AppError } from '../middlewares/errorHandler'
import { prisma } from '../lib/prisma'
import { computeMonthlyDue, daysBetween, daysInYear, occupiedDaysInYear, overlapDays, periodBounds, round2 } from '../lib/period'
import { allocate } from '../lib/ownership'
import { renderRegularizationPdf } from '../lib/lettersPdf'
import { chargesRepository, ChargeInput, findLeaseForDocuments, LeaseForDocuments, regularizationsRepository } from '../repositories/charges'
import { landlordsFor } from './landlords'

async function chargeOrThrow(id: string, userId: string) {
  const charge = await chargesRepository.findById(id, userId)
  if (!charge) throw new AppError(404, 'Charge introuvable')
  return charge
}

export async function leaseOrThrow(id: string, userId: string) {
  const lease = await findLeaseForDocuments(id, userId)
  if (!lease) throw new AppError(404, 'Bail introuvable')
  return lease
}

/** Calcul de la régularisation d'un bail pour une année (sans l'enregistrer). */
async function compute(lease: LeaseForDocuments, year: number) {
  const occupiedDays = occupiedDaysInYear(lease, year)
  if (!occupiedDays) throw new AppError(400, `Le bail ne couvre pas l’année ${year}`)
  const dy = daysInYear(year)
  const charges = (await chargesRepository.forPropertyYear(lease.propertyId, year)).map((c) => {
    // Part du locataire : montant × jours occupés dans la période de la charge (trimestre ou année) / jours de la période
    const period = periodBounds(year, c.quarter)
    const days = overlapDays(period, lease.startDate, lease.endDate)
    return { id: c.id, label: c.label, quarter: c.quarter, amount: c.amount, occupiedDays: days, periodDays: daysBetween(period.start, period.end), share: round2(c.amount * days / daysBetween(period.start, period.end)) }
  })
  const totalCharges = round2(charges.reduce((s, c) => s + c.amount, 0))
  const totalReal = round2(charges.reduce((s, c) => s + c.share, 0))
  const payments = await regularizationsRepository.paymentsOfYear(lease.id, year)
  const totalCharged = round2(payments.reduce((s, p) => s + p.chargesAmount, 0))
  // Mois couverts par le bail dont l'échéance n'a pas été générée : provisions non comptées
  const generated = new Set(payments.map((p) => p.periodMonth))
  const missingMonths = Array.from({ length: 12 }, (_, i) => i + 1)
    .filter((m) => computeMonthlyDue(lease, year, m) && !generated.has(m))
  return {
    year,
    occupiedDays,
    daysInYear: dy,
    charges,
    totalCharges,
    totalReal,
    totalCharged,
    balance: round2(totalReal - totalCharged),
    missingMonths,
    suggestedMonthlyCharges: round2(totalCharges / 12),
  }
}

export const chargesService = {
  list: (userId: string, filter: { year?: number; propertyId?: string }) => chargesRepository.findMany(userId, filter),

  async create(userId: string, data: ChargeInput) {
    const property = await prisma.property.findFirst({ where: { id: data.propertyId, ownerships: { some: { userId } } }, select: { id: true } })
    if (!property) throw new AppError(404, 'Bien introuvable')
    return chargesRepository.create(data)
  },

  /**
   * Répartition des charges de l'année entre propriétaires : pour chaque charge, quote-part × jours détenus
   * dans la période de la charge / jours de la période. Seuls les biens de l'utilisateur sont listés.
   */
  async allocation(userId: string, year: number) {
    const properties = await prisma.property.findMany({
      where: { ownerships: { some: { userId } }, charges: { some: { year } } },
      include: { charges: { where: { year } }, ownerships: { include: { user: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: 'asc' } } },
      orderBy: { name: 'asc' },
    })
    return properties.map((p) => {
      const totals = new Map<string, number>()
      for (const c of p.charges) {
        for (const a of allocate(c.amount, periodBounds(year, c.quarter), p.ownerships)) totals.set(a.userId, (totals.get(a.userId) ?? 0) + a.amount)
      }
      const total = round2(p.charges.reduce((s, c) => s + c.amount, 0))
      const owners = p.ownerships.map((o) => ({
        userId: o.userId, name: `${o.user.firstName} ${o.user.lastName}`, share: o.share, startDate: o.startDate, endDate: o.endDate,
        amount: round2(totals.get(o.userId) ?? 0),
      })).filter((o) => o.amount > 0)
      return { propertyId: p.id, propertyName: p.name, total, owners }
    })
  },

  async update(id: string, userId: string, data: Partial<Omit<ChargeInput, 'propertyId'>>) {
    await chargeOrThrow(id, userId)
    return chargesRepository.update(id, data)
  },

  async remove(id: string, userId: string) {
    await chargeOrThrow(id, userId)
    await chargesRepository.delete(id)
  },
}

export const regularizationsService = {
  async list(leaseId: string, userId: string) {
    await leaseOrThrow(leaseId, userId)
    return regularizationsRepository.findByLease(leaseId)
  },

  async preview(leaseId: string, userId: string, year: number) {
    const lease = await leaseOrThrow(leaseId, userId)
    return { ...(await compute(lease, year)), existing: await regularizationsRepository.find(leaseId, year) }
  },

  async create(leaseId: string, userId: string, year: number) {
    const lease = await leaseOrThrow(leaseId, userId)
    if (await regularizationsRepository.find(leaseId, year)) {
      throw new AppError(409, `La régularisation ${year} existe déjà : supprimez-la pour la refaire`)
    }
    const r = await compute(lease, year)
    if (!r.charges.length) throw new AppError(409, `Aucune charge saisie pour ce bien en ${year} (page Charges)`)
    return regularizationsRepository.create({
      leaseId, year, occupiedDays: r.occupiedDays, daysInYear: r.daysInYear,
      totalCharged: r.totalCharged, totalReal: r.totalReal, balance: r.balance,
    })
  },

  async remove(leaseId: string, id: string, userId: string) {
    await leaseOrThrow(leaseId, userId)
    if (!(await regularizationsRepository.findById(id, leaseId))) throw new AppError(404, 'Régularisation introuvable')
    await regularizationsRepository.delete(id)
  },

  /** Décompte de régularisation en PDF (recalcule le détail des charges, montants enregistrés). */
  async statement(leaseId: string, id: string, userId: string) {
    const lease = await leaseOrThrow(leaseId, userId)
    const reg = await regularizationsRepository.findById(id, leaseId)
    if (!reg) throw new AppError(404, 'Régularisation introuvable')
    const detail = await compute(lease, reg.year)
    const pdf = await renderRegularizationPdf({
      landlords: await landlordsFor(lease.property.ownerships, new Date()),
      tenantName: `${lease.tenant.firstName} ${lease.tenant.lastName}`,
      property: lease.property,
      year: reg.year,
      occupiedDays: reg.occupiedDays,
      daysInYear: reg.daysInYear,
      charges: detail.charges,
      totalCharges: detail.totalCharges,
      totalReal: reg.totalReal,
      totalCharged: reg.totalCharged,
      balance: reg.balance,
      issuedAt: new Date(),
    })
    return { pdf, fileName: `regularisation-charges-${reg.year}-${lease.tenant.lastName.normalize('NFD').replace(/[^A-Za-z0-9-]/g, '')}.pdf` }
  },
}
