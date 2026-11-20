import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'

export type CreateTenantInput = {
  firstName: string
  lastName: string
  email: string
  phone?: string
  iban?: string
}

export type UpdateTenantInput = Partial<CreateTenantInput>

/** Baux sur un bien dont l'utilisateur est (co)propriétaire. */
export const ownedLease = (userId: string): Prisma.LeaseWhereInput => ({ property: { ownerships: { some: { userId } } } })

/**
 * Un locataire est visible par l'utilisateur qui l'a saisi, et par les propriétaires des biens qu'il loue
 * ou a loués. Seuls les baux de ces biens sont renvoyés (pas ceux d'un autre propriétaire).
 */
const visibleTenant = (userId: string): Prisma.TenantWhereInput => ({
  OR: [{ createdById: userId }, { leases: { some: ownedLease(userId) } }],
})

const leasesInclude = (userId: string) => ({
  where: ownedLease(userId),
  include: { property: { select: { id: true, name: true, city: true } } },
  orderBy: { startDate: 'desc' as const },
})

export const tenantsRepository = {
  findAll(userId: string) {
    return prisma.tenant.findMany({
      where: visibleTenant(userId),
      include: { leases: leasesInclude(userId) },
      orderBy: { lastName: 'asc' },
    })
  },

  findById(id: string, userId: string) {
    return prisma.tenant.findFirst({
      where: { id, ...visibleTenant(userId) },
      include: { leases: leasesInclude(userId), documents: true },
    })
  },

  /** Nombre total de baux du locataire, tous propriétaires confondus (pour refuser une suppression). */
  countLeases(id: string) {
    return prisma.lease.count({ where: { tenantId: id } })
  },

  create(data: CreateTenantInput, createdById: string) {
    return prisma.tenant.create({ data: { ...data, createdById } })
  },

  update(id: string, data: UpdateTenantInput) {
    return prisma.tenant.update({ where: { id }, data })
  },

  delete(id: string) {
    return prisma.tenant.delete({ where: { id } })
  },
}
