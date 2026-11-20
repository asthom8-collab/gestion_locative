import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'

const listInclude = {
  lease: {
    select: {
      id: true,
      rentDayOfMonth: true,
      property: { select: { id: true, name: true, address: true, city: true } },
      tenant: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  },
  receipt: true,
} satisfies Prisma.RentPaymentInclude

export type RentPaymentWithLease = Prisma.RentPaymentGetPayload<{ include: typeof listInclude }>

export type ListFilter = { year?: number; month?: number; leaseId?: string }

export const rentPaymentsRepository = {
  findMany({ year, month, leaseId }: ListFilter) {
    return prisma.rentPayment.findMany({
      where: { periodYear: year, periodMonth: month, leaseId },
      include: listInclude,
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }, { lease: { property: { name: 'asc' } } }],
    })
  },

  findById(id: string) {
    return prisma.rentPayment.findUnique({ where: { id }, include: listInclude })
  },

  /** Paiement avec tout ce qu'il faut pour la quittance (bailleurs, locataire, logement). */
  findForReceipt(id: string) {
    return prisma.rentPayment.findUnique({
      where: { id },
      include: {
        receipt: true,
        lease: {
          include: {
            tenant: true,
            property: { include: { ownerships: { include: { user: true }, orderBy: { createdAt: 'asc' } } } },
          },
        },
      },
    })
  },

  /** Baux qui couvrent au moins un jour de la période [start, end]. */
  findLeasesCovering(start: Date, end: Date) {
    return prisma.lease.findMany({
      where: {
        startDate: { lte: new Date(end.getTime() + 86_399_999) },
        OR: [{ endDate: null, active: true }, { endDate: { gte: start } }],
      },
    })
  },

  createMany(data: Prisma.RentPaymentCreateManyInput[]) {
    return prisma.rentPayment.createMany({ data, skipDuplicates: true })
  },

  update(id: string, data: Prisma.RentPaymentUpdateInput) {
    return prisma.rentPayment.update({ where: { id }, data, include: listInclude })
  },

  delete(id: string) {
    return prisma.rentPayment.delete({ where: { id } })
  },

  upsertReceipt(rentPaymentId: string, filePath: string) {
    return prisma.receipt.upsert({
      where: { rentPaymentId },
      create: { rentPaymentId, filePath },
      update: { filePath, createdAt: new Date(), sentAt: null },
    })
  },

  deleteReceipt(rentPaymentId: string) {
    return prisma.receipt.deleteMany({ where: { rentPaymentId } })
  },
}
