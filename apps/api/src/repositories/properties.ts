import { prisma } from '../lib/prisma'
import { FiscalRegime, PropertyType } from '@prisma/client'

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
  share?: number
}

export type UpdatePropertyInput = Partial<Omit<CreatePropertyInput, 'userId' | 'share'>>

export const propertiesRepository = {
  findAll(userId: string) {
    return prisma.property.findMany({
      where: { ownerships: { some: { userId } } },
      include: {
        ownerships: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        leases: {
          where: { active: true },
          include: { tenant: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  },

  findById(id: string, userId: string) {
    return prisma.property.findFirst({
      where: { id, ownerships: { some: { userId } } },
      include: {
        ownerships: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        leases: { include: { tenant: true } },
      },
    })
  },

  create({ userId, share = 1.0, ...data }: CreatePropertyInput) {
    return prisma.property.create({
      data: {
        ...data,
        ownerships: { create: { userId, share } },
      },
      include: { ownerships: true },
    })
  },

  update(id: string, data: UpdatePropertyInput) {
    return prisma.property.update({ where: { id }, data })
  },

  delete(id: string) {
    return prisma.property.delete({ where: { id } })
  },
}
