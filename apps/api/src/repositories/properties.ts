import { prisma } from '../lib/prisma'
import { FiscalRegime, PropertyType } from '@prisma/client'

const ownershipsInclude = {
  include: { user: { select: { id: true, firstName: true, lastName: true } } },
  orderBy: { createdAt: 'asc' },
} as const

export type CreatePropertyInput = {
  name: string
  address: string
  zipCode: string
  city: string
  type: PropertyType
  surface: number
  fiscalRegime: FiscalRegime
  irlQuarter: number
  userId: string
}

export type UpdatePropertyInput = Partial<Omit<CreatePropertyInput, 'userId'>>

export const propertiesRepository = {
  findAll(userId: string) {
    return prisma.property.findMany({
      where: { ownerships: { some: { userId } } },
      include: {
        ownerships: ownershipsInclude,
        // Tous les baux (en cours et terminés) : historique des locataires du bien
        leases: { include: { tenant: true }, orderBy: { startDate: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    })
  },

  findById(id: string, userId: string) {
    return prisma.property.findFirst({
      where: { id, ownerships: { some: { userId } } },
      include: {
        ownerships: ownershipsInclude,
        leases: { include: { tenant: true }, orderBy: { startDate: 'desc' } },
      },
    })
  },

  /** Le créateur est propriétaire à 100 % ; les copropriétaires s'ajoutent ensuite (setOwners). */
  create({ userId, ...data }: CreatePropertyInput) {
    return prisma.property.create({
      data: { ...data, ownerships: { create: { userId, share: 1 } } },
      include: { ownerships: true },
    })
  },

  countUsers(ids: string[]) {
    return prisma.user.count({ where: { id: { in: ids } } })
  },

  /** Remplace toute la liste des copropriétaires (quotes-parts) en une transaction. */
  async setOwners(propertyId: string, owners: { userId: string; share: number }[]) {
    await prisma.$transaction([
      prisma.ownership.deleteMany({ where: { propertyId, userId: { notIn: owners.map((o) => o.userId) } } }),
      ...owners.map((o) => prisma.ownership.upsert({
        where: { propertyId_userId: { propertyId, userId: o.userId } },
        create: { propertyId, userId: o.userId, share: o.share },
        update: { share: o.share },
      })),
    ])
    return prisma.ownership.findMany({ where: { propertyId }, ...ownershipsInclude })
  },

  update(id: string, data: UpdatePropertyInput) {
    return prisma.property.update({ where: { id }, data })
  },

  delete(id: string) {
    // Les quotes-parts (Ownership) n'ont pas de suppression en cascade : on les retire d'abord
    return prisma.$transaction([
      prisma.ownership.deleteMany({ where: { propertyId: id } }),
      prisma.property.delete({ where: { id } }),
    ])
  },
}
