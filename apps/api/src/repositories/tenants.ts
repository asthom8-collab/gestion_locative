import { prisma } from '../lib/prisma'

export type CreateTenantInput = {
  firstName: string
  lastName: string
  email: string
  phone?: string
  iban?: string
}

export type UpdateTenantInput = Partial<CreateTenantInput>

export const tenantsRepository = {
  findAll() {
    return prisma.tenant.findMany({
      include: {
        leases: {
          where: { active: true },
          include: {
            property: { select: { id: true, name: true, city: true } },
          },
        },
      },
      orderBy: { lastName: 'asc' },
    })
  },

  findById(id: string) {
    return prisma.tenant.findUnique({
      where: { id },
      include: {
        leases: {
          include: {
            property: { select: { id: true, name: true, city: true } },
          },
        },
        documents: true,
      },
    })
  },

  create(data: CreateTenantInput) {
    return prisma.tenant.create({ data })
  },

  update(id: string, data: UpdateTenantInput) {
    return prisma.tenant.update({ where: { id }, data })
  },

  delete(id: string) {
    return prisma.tenant.delete({ where: { id } })
  },
}
