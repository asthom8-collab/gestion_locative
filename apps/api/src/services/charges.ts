import { AppError } from '../middlewares/errorHandler'
import { prisma } from '../lib/prisma'
import { computeMonthlyDue, daysBetween, daysInYear, occupiedDaysInYear, overlapDays, periodBounds, round2 } from '../lib/period'
import { allocate, ownersAt } from '../lib/ownership'
import { Prisma } from '@prisma/client'
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

type StoredRegularization = { occupiedDays: number; totalReal: number; totalCharged: number; balance: number }

/**
 * Régularisation périmée : le recalcul ne donne plus les montants enregistrés (charge ajoutée, modifiée ou supprimée
 * après coup, provisions ou dates du bail changées). Renvoie le solde recalculé, ou null si le bail ne couvre plus l'année.
 */
async function staleness(lease: LeaseForDocuments, reg: StoredRegularization & { year: number }) {
  let r: Awaited<ReturnType<typeof compute>>
  try { r = await compute(lease, reg.year) } catch { return { outdated: true, currentBalance: null } }
  const differs = (a: number, b: number) => Math.abs(a - b) >= 0.005
  const outdated = r.occupiedDays !== reg.occupiedDays || differs(r.totalReal, reg.totalReal) || differs(r.totalCharged, reg.totalCharged)
  return { outdated, currentBalance: r.balance }
}

export const REGULARIZATION_OUTDATED_KIND = 'REGULARIZATION_OUTDATED'
const yearKey = (year: number) => new Date(Date.UTC(year, 0, 1))
const eur = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)

/** Retire les alertes « régularisation à refaire » d'un bail et d'une année (régularisation refaite, supprimée ou redevenue juste). */
function clearOutdatedNotifications(leaseId: string, year: number) {
  return prisma.notification.deleteMany({ where: { kind: REGULARIZATION_OUTDATED_KIND, leaseId, dueDate: yearKey(year) } })
}

/**
 * Après une modification des charges d'un bien pour une année : pour chaque régularisation enregistrée devenue fausse,
 * une notification (cloche) à chaque propriétaire actuel du bien, une seule fois par bail et par année ; si elle est
 * redevenue juste, l'alerte est retirée.
 */
export async function checkRegularizations(propertyId: string, year: number, userId: string) {
  const regs = await prisma.chargeRegularization.findMany({ where: { year, lease: { propertyId } } })
  for (const reg of regs) {
    const lease = await findLeaseForDocuments(reg.leaseId, userId)
    if (!lease) continue
    const s = await staleness(lease, reg)
    if (!s.outdated) { await clearOutdatedNotifications(reg.leaseId, year); continue }
    const tenant = `${lease.tenant.firstName} ${lease.tenant.lastName}`
    const body = `Les charges ${year} de ${lease.property.name} ont changé depuis l'enregistrement de la régularisation de ${tenant} : `
      + `solde enregistré ${eur(reg.balance)}${s.currentBalance != null ? `, recalculé ${eur(s.currentBalance)}` : ''}. `
      + 'Ouvrez le bail et cliquez sur « Mettre à jour ».'
    for (const o of ownersAt(lease.property.ownerships, new Date())) {
      const where = { userId: o.userId, kind: REGULARIZATION_OUTDATED_KIND, leaseId: reg.leaseId, dueDate: yearKey(year) }
      if (await prisma.notification.findFirst({ where, select: { id: true } })) continue // déjà signalée
      try {
        await prisma.notification.create({ data: {
          userId: o.userId, kind: REGULARIZATION_OUTDATED_KIND, leaseId: reg.leaseId, dueDate: yearKey(year),
          title: `Régularisation ${year} à refaire : ${tenant}`, body, link: `/leases/${reg.leaseId}`,
        } })
      } catch (e) {
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e // déjà signalée
      }
    }
  }
}

export const chargesService = {
  list: (userId: string, filter: { year?: number; propertyId?: string }) => chargesRepository.findMany(userId, filter),

  async create(userId: string, data: ChargeInput) {
    const property = await prisma.property.findFirst({ where: { id: data.propertyId, ownerships: { some: { userId } } }, select: { id: true } })
    if (!property) throw new AppError(404, 'Bien introuvable')
    const charge = await chargesRepository.create(data)
    await checkRegularizations(charge.propertyId, charge.year, userId)
    return charge
  },

  /**
   * Répartition des charges de l'année d'un bien :
   * - entre locataires : part de chaque bail (jours occupés dans la période de chaque charge), provisions appelées,
   *   solde, et régularisation déjà faite ; le reste (vacance) reste à la charge des propriétaires ;
   * - entre propriétaires : quote-part × jours détenus dans la période de la charge / jours de la période.
   * Seuls les biens de l'utilisateur sont listés.
   */
  async allocation(userId: string, year: number) {
    const properties = await prisma.property.findMany({
      where: { ownerships: { some: { userId } }, charges: { some: { year } } },
      include: { charges: { where: { year } }, ownerships: { include: { user: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: 'asc' } } },
      orderBy: { name: 'asc' },
    })
    const yStart = new Date(Date.UTC(year, 0, 1)), yEnd = new Date(Date.UTC(year, 11, 31))
    return Promise.all(properties.map(async (p) => {
      const leaseIds = await prisma.lease.findMany({
        where: { propertyId: p.id, startDate: { lte: yEnd }, OR: [{ endDate: null }, { endDate: { gte: yStart } }] },
        select: { id: true }, orderBy: { startDate: 'asc' },
      })
      const tenants = []
      for (const { id } of leaseIds) {
        const lease = await leaseOrThrow(id, userId)
        const r = await compute(lease, year)
        const existing = await regularizationsRepository.find(id, year)
        tenants.push({
          leaseId: id, tenantName: `${lease.tenant.firstName} ${lease.tenant.lastName}`, startDate: lease.startDate, endDate: lease.endDate,
          occupiedDays: r.occupiedDays, share: r.totalReal, provisions: r.totalCharged, balance: r.balance,
          missingMonths: r.missingMonths,
          regularization: existing ? { id: existing.id, balance: existing.balance, ...(await staleness(lease, existing)) } : null,
        })
      }
      const totals = new Map<string, number>()
      for (const c of p.charges) {
        for (const a of allocate(c.amount, periodBounds(year, c.quarter), p.ownerships)) totals.set(a.userId, (totals.get(a.userId) ?? 0) + a.amount)
      }
      const total = round2(p.charges.reduce((s, c) => s + c.amount, 0))
      const owners = p.ownerships.map((o) => ({
        userId: o.userId, name: `${o.user.firstName} ${o.user.lastName}`, share: o.share, startDate: o.startDate, endDate: o.endDate,
        amount: round2(totals.get(o.userId) ?? 0),
      })).filter((o) => o.amount > 0)
      const vacancy = round2(total - tenants.reduce((s, t) => s + t.share, 0))
      return { propertyId: p.id, propertyName: p.name, total, tenants, vacancy, owners }
    }))
  },

  /** Régularisations enregistrées sur les biens de l'utilisateur qui ne correspondent plus au calcul (alerte). */
  async outdatedRegularizations(userId: string) {
    const regs = await prisma.chargeRegularization.findMany({
      where: { lease: { property: { ownerships: { some: { userId } } } } }, orderBy: [{ year: 'desc' }, { createdAt: 'asc' }],
    })
    const rows = []
    for (const reg of regs) {
      const lease = await leaseOrThrow(reg.leaseId, userId)
      const s = await staleness(lease, reg)
      if (!s.outdated) continue
      rows.push({
        id: reg.id, leaseId: reg.leaseId, year: reg.year, createdAt: reg.createdAt,
        tenantName: `${lease.tenant.firstName} ${lease.tenant.lastName}`, propertyName: lease.property.name,
        balance: reg.balance, currentBalance: s.currentBalance,
      })
    }
    return rows
  },

  async update(id: string, userId: string, data: Partial<Omit<ChargeInput, 'propertyId'>>) {
    const before = await chargeOrThrow(id, userId)
    const charge = await chargesRepository.update(id, data)
    await checkRegularizations(charge.propertyId, charge.year, userId)
    if (before.year !== charge.year) await checkRegularizations(charge.propertyId, before.year, userId)
    return charge
  },

  async remove(id: string, userId: string) {
    const charge = await chargeOrThrow(id, userId)
    await chargesRepository.delete(id)
    await checkRegularizations(charge.propertyId, charge.year, userId)
  },
}

export const regularizationsService = {
  async list(leaseId: string, userId: string) {
    await leaseOrThrow(leaseId, userId)
    return regularizationsRepository.findByLease(leaseId)
  },

  async preview(leaseId: string, userId: string, year: number) {
    const lease = await leaseOrThrow(leaseId, userId)
    const r = await compute(lease, year)
    const existing = await regularizationsRepository.find(leaseId, year)
    const outdated = !!existing && (existing.occupiedDays !== r.occupiedDays
      || Math.abs(existing.totalReal - r.totalReal) >= 0.005 || Math.abs(existing.totalCharged - r.totalCharged) >= 0.005)
    return { ...r, existing, outdated }
  },

  async create(leaseId: string, userId: string, year: number) {
    const lease = await leaseOrThrow(leaseId, userId)
    if (await regularizationsRepository.find(leaseId, year)) {
      throw new AppError(409, `La régularisation ${year} existe déjà : supprimez-la pour la refaire`)
    }
    const r = await compute(lease, year)
    if (!r.charges.length) throw new AppError(409, `Aucune charge saisie pour ce bien en ${year} (page Charges)`)
    await clearOutdatedNotifications(leaseId, year)
    return regularizationsRepository.create({
      leaseId, year, occupiedDays: r.occupiedDays, daysInYear: r.daysInYear,
      totalCharged: r.totalCharged, totalReal: r.totalReal, balance: r.balance,
    })
  },

  async remove(leaseId: string, id: string, userId: string) {
    await leaseOrThrow(leaseId, userId)
    const reg = await regularizationsRepository.findById(id, leaseId)
    if (!reg) throw new AppError(404, 'Régularisation introuvable')
    await regularizationsRepository.delete(id)
    await clearOutdatedNotifications(leaseId, reg.year)
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
