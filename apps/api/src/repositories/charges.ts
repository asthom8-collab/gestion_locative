import { prisma } from '../lib/prisma'
import { ownershipsWithUsers } from '../services/landlords'
import { ownedLease } from './tenants'

const owned = (userId: string) => ({ property: { ownerships: { some: { userId } } } })

export type ChargeInput = { propertyId: string; year: number; label: string; amount: number }

export const chargesRepository = {
  findMany(userId: string, filter: { year?: number; propertyId?: string }) {
    return prisma.charge.findMany({
      where: { ...owned(userId), year: filter.year, propertyId: filter.propertyId },
      orderBy: [{ year: 'desc' }, { createdAt: 'asc' }],
    })
  },
  findById(id: string, userId: string) {
    return prisma.charge.findFirst({ where: { id, ...owned(userId) } })
  },
  forPropertyYear(propertyId: string, year: number) {
    return prisma.charge.findMany({ where: { propertyId, year }, orderBy: { createdAt: 'asc' } })
  },
  create(data: ChargeInput) { return prisma.charge.create({ data }) },
  update(id: string, data: Partial<Omit<ChargeInput, 'propertyId'>>) { return prisma.charge.update({ where: { id }, data }) },
  delete(id: string) { return prisma.charge.delete({ where: { id } }) },
}

/** Bail de l'utilisateur, avec ce qu'il faut pour les calculs et les courriers. */
export function findLeaseForDocuments(id: string, userId: string) {
  return prisma.lease.findFirst({
    where: { id, ...ownedLease(userId) },
    include: {
      tenant: true,
      property: { include: { ownerships: ownershipsWithUsers } },
      rentRevisions: { orderBy: { effectiveDate: 'asc' } },
    },
  })
}
export type LeaseForDocuments = NonNullable<Awaited<ReturnType<typeof findLeaseForDocuments>>>

export const regularizationsRepository = {
  findByLease(leaseId: string) {
    return prisma.chargeRegularization.findMany({ where: { leaseId }, orderBy: { year: 'desc' } })
  },
  find(leaseId: string, year: number) {
    return prisma.chargeRegularization.findUnique({ where: { leaseId_year: { leaseId, year } } })
  },
  findById(id: string, leaseId: string) {
    return prisma.chargeRegularization.findFirst({ where: { id, leaseId } })
  },
  create(data: { leaseId: string; year: number; occupiedDays: number; daysInYear: number; totalCharged: number; totalReal: number; balance: number }) {
    return prisma.chargeRegularization.create({ data })
  },
  delete(id: string) { return prisma.chargeRegularization.delete({ where: { id } }) },
  paymentsOfYear(leaseId: string, year: number) {
    return prisma.rentPayment.findMany({ where: { leaseId, periodYear: year }, select: { periodMonth: true, chargesAmount: true } })
  },
}
