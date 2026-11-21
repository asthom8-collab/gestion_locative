import { prisma } from '../lib/prisma'
import { LeaseType } from '@prisma/client'
import { ownedLease } from './tenants'

export type CreateLeaseInput = {
  propertyId: string
  tenantId: string
  type: LeaseType
  startDate: Date
  endDate?: Date
  rentAmount: number
  chargesAmount: number
  rentDayOfMonth?: number
  irlReference?: number
  irlQuarter?: number
  irlYear?: number
}

export type UpdateLeaseInput = Partial<Omit<CreateLeaseInput, 'propertyId' | 'tenantId'>>

export const leasesRepository = {
  findAll(userId: string) {
    return prisma.lease.findMany({
      where: ownedLease(userId),
      include: {
        property: { select: { id: true, name: true, address: true, city: true } },
        tenant: { select: { id: true, firstName: true, lastName: true, email: true } },
        // Dernière révision IRL : le tableau de bord ne rappelle pas une révision déjà faite
        rentRevisions: { select: { effectiveDate: true }, orderBy: { effectiveDate: 'desc' }, take: 1 },
      },
      orderBy: { startDate: 'desc' },
    })
  },

  findByProperty(propertyId: string, userId: string) {
    return prisma.lease.findMany({
      where: { propertyId, ...ownedLease(userId) },
      include: {
        tenant: { select: { id: true, firstName: true, lastName: true, email: true } },
        rentPayments: { orderBy: { periodYear: 'desc' }, take: 3 },
      },
      orderBy: { startDate: 'desc' },
    })
  },

  findById(id: string, userId: string) {
    return prisma.lease.findFirst({
      where: { id, ...ownedLease(userId) },
      include: {
        property: true,
        tenant: true,
        rentPayments: {
          orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
        },
        documents: true,
        inventories: true,
      },
    })
  },

  create(data: CreateLeaseInput) {
    return prisma.lease.create({
      data,
      include: {
        property: { select: { id: true, name: true } },
        tenant: { select: { id: true, firstName: true, lastName: true } },
      },
    })
  },

  update(id: string, data: UpdateLeaseInput) {
    return prisma.lease.update({ where: { id }, data })
  },

  terminate(id: string, endDate: Date) {
    return prisma.lease.update({
      where: { id },
      data: { active: false, endDate },
    })
  },
}
