import { DocumentCategory, Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { ownedLease } from './tenants'

const ownedProperty = (userId: string): Prisma.PropertyWhereInput => ({ ownerships: { some: { userId } } })

/** Un document est visible par les (co)propriétaires du bien, qu'il soit rattaché au bien ou à l'un de ses baux. */
const visible = (userId: string): Prisma.DocumentWhereInput => ({
  OR: [{ lease: ownedLease(userId) }, { property: ownedProperty(userId) }],
})

const include = {
  property: { select: { id: true, name: true } },
  intervention: { select: { id: true, title: true, date: true } },
  lease: {
    select: {
      id: true, startDate: true, endDate: true, active: true,
      property: { select: { id: true, name: true } },
      tenant: { select: { id: true, firstName: true, lastName: true } },
    },
  },
} satisfies Prisma.DocumentInclude

export type DocumentWithLinks = Prisma.DocumentGetPayload<{ include: typeof include }>

export type DocumentFilter = { userId: string; leaseId?: string; propertyId?: string; interventionId?: string; category?: DocumentCategory }

export const documentsRepository = {
  /** Avec propertyId : les documents du bien et ceux de ses baux. */
  findMany({ userId, leaseId, propertyId, interventionId, category }: DocumentFilter) {
    const and: Prisma.DocumentWhereInput[] = [visible(userId)]
    if (leaseId) and.push({ leaseId })
    if (propertyId) and.push({ OR: [{ propertyId }, { lease: { propertyId } }] })
    if (interventionId) and.push({ interventionId })
    if (category) and.push({ category })
    return prisma.document.findMany({ where: { AND: and }, include, orderBy: { createdAt: 'desc' } })
  },

  findById(id: string, userId: string) {
    return prisma.document.findFirst({ where: { AND: [{ id }, visible(userId)] }, include })
  },

  leaseExists(id: string, userId: string) {
    return prisma.lease.count({ where: { id, ...ownedLease(userId) } }).then((n) => n > 0)
  },

  findIntervention(id: string, userId: string) {
    return prisma.intervention.findFirst({ where: { id, property: ownedProperty(userId) }, select: { propertyId: true } })
  },

  propertyExists(id: string, userId: string) {
    return prisma.property.count({ where: { id, ...ownedProperty(userId) } }).then((n) => n > 0)
  },

  create(data: Prisma.DocumentUncheckedCreateInput) {
    return prisma.document.create({ data, include })
  },

  update(id: string, data: { label?: string; category?: DocumentCategory }) {
    return prisma.document.update({ where: { id }, data, include })
  },

  delete(id: string) {
    return prisma.document.delete({ where: { id } })
  },

  /** Documents rattachés directement à un bien (pour sa suppression). */
  findByProperty(propertyId: string) {
    return prisma.document.findMany({ where: { propertyId }, select: { id: true, filePath: true } })
  },

  deleteByProperty(propertyId: string) {
    return prisma.document.deleteMany({ where: { propertyId } })
  },
}
