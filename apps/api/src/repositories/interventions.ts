import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { ownedLease } from './tenants'

const owned = (userId: string): Prisma.InterventionWhereInput => ({ property: { ownerships: { some: { userId } } } })

const include = {
  property: { select: { id: true, name: true, type: true, fiscalRegime: true } },
  lease: { select: { id: true, tenant: { select: { id: true, firstName: true, lastName: true } } } },
  documents: { select: { id: true, label: true, category: true, mimeType: true }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.InterventionInclude

export type InterventionWithLinks = Prisma.InterventionGetPayload<{ include: typeof include }>
export type InterventionFilter = { userId: string; propertyId?: string; leaseId?: string; year?: number; kind?: Prisma.InterventionWhereInput['kind'] }
export type InterventionData = Omit<Prisma.InterventionUncheckedCreateInput, 'id' | 'createdAt' | 'updatedAt'>

export const interventionsRepository = {
  findMany({ userId, propertyId, leaseId, year, kind }: InterventionFilter) {
    const date = year ? { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } : undefined
    return prisma.intervention.findMany({
      where: { ...owned(userId), propertyId, leaseId, kind, date },
      include,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    })
  },
  findById(id: string, userId: string) {
    return prisma.intervention.findFirst({ where: { id, ...owned(userId) }, include })
  },
  propertyExists(id: string, userId: string) {
    return prisma.property.count({ where: { id, ownerships: { some: { userId } } } }).then((n) => n > 0)
  },
  /** Bail de l'utilisateur, pour vérifier qu'il porte sur le bien de l'intervention. */
  findLease(id: string, userId: string) {
    return prisma.lease.findFirst({ where: { id, ...ownedLease(userId) }, select: { id: true, propertyId: true } })
  },
  create(data: InterventionData) { return prisma.intervention.create({ data, include }) },
  update(id: string, data: Partial<InterventionData>) { return prisma.intervention.update({ where: { id }, data, include }) },
  delete(id: string) { return prisma.intervention.delete({ where: { id } }) },
  /** Années où le bien de l'utilisateur a des interventions (filtre de la page). */
  async years(userId: string) {
    const rows = await prisma.intervention.findMany({ where: owned(userId), select: { date: true } })
    return [...new Set(rows.map((r) => r.date.getUTCFullYear()))].sort((a, b) => b - a)
  },
}
