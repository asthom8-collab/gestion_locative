import { prisma } from '../lib/prisma'

export const publicUserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  address: true,
  zipCode: true,
  city: true,
} as const

export type UpdateProfileInput = {
  firstName?: string
  lastName?: string
  address?: string | null
  zipCode?: string | null
  city?: string | null
}

export const usersRepository = {
  findById(id: string) {
    return prisma.user.findUnique({ where: { id }, select: publicUserSelect })
  },

  update(id: string, data: UpdateProfileInput) {
    return prisma.user.update({ where: { id }, data, select: publicUserSelect })
  },
}
