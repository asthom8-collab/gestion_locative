import { prisma } from '../lib/prisma'
import { Role } from '@prisma/client'

export const publicUserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  address: true,
  zipCode: true,
  city: true,
  mustChangePassword: true,
  signaturePath: true,
  notifyDaysBefore: true,
  notifyEmail: true,
  ntfyTopic: true,
  freeMobileUser: true,
  freeMobileKey: true,
} as const

/** Ce que voit un autre utilisateur (pour choisir un copropriétaire). */
export const directorySelect = { id: true, firstName: true, lastName: true, email: true } as const

export type UpdateProfileInput = {
  email?: string
  firstName?: string
  lastName?: string
  address?: string | null
  zipCode?: string | null
  city?: string | null
  notifyDaysBefore?: number
  notifyEmail?: boolean
  ntfyTopic?: string | null
  freeMobileUser?: string | null
  freeMobileKey?: string | null
}

export type CreateUserInput = { email: string; firstName: string; lastName: string; passwordHash: string; role: Role }

export const usersRepository = {
  findById(id: string) {
    return prisma.user.findUnique({ where: { id }, select: publicUserSelect })
  },

  findCredentials(email: string) {
    return prisma.user.findUnique({
      where: { email },
      select: { id: true, passwordHash: true, sessionVersion: true },
    })
  },

  findPasswordHash(id: string) {
    return prisma.user.findUnique({ where: { id }, select: { passwordHash: true, sessionVersion: true } })
  },

  directory() {
    return prisma.user.findMany({ select: directorySelect, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] })
  },

  existsByEmail(email: string) {
    return prisma.user.count({ where: { email } }).then((n) => n > 0)
  },

  create(data: CreateUserInput) {
    return prisma.user.create({ data: { ...data, mustChangePassword: true }, select: publicUserSelect })
  },

  update(id: string, data: UpdateProfileInput) {
    return prisma.user.update({ where: { id }, data, select: publicUserSelect })
  },

  /** Nouveau mot de passe : la version de session change, les autres sessions sont fermées. */
  setPassword(id: string, passwordHash: string, mustChangePassword: boolean) {
    return prisma.user.update({
      where: { id },
      data: { passwordHash, mustChangePassword, sessionVersion: { increment: 1 } },
      select: { sessionVersion: true },
    })
  },

  setSignature(id: string, signaturePath: string | null) {
    return prisma.user.update({ where: { id }, data: { signaturePath }, select: publicUserSelect })
  },
}
