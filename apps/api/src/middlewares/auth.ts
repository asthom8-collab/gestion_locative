import type { NextFunction, Request, Response } from 'express'
import type { Role } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { readSessionToken, sessionCookieFrom } from '../lib/auth'
import { AppError } from './errorHandler'

export type AuthUser = { id: string; role: Role; mustChangePassword: boolean; sessionVersion: number }

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request { user?: AuthUser }
  }
}

/** Routes accessibles avec un mot de passe provisoire (le front force alors le changement). */
const ALLOWED_WITH_TEMP_PASSWORD = new Set(['GET /me', 'PUT /me/password', 'POST /auth/logout'])

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const session = readSessionToken(sessionCookieFrom(req))
    if (!session) throw new AppError(401, 'Connexion requise')
    const user = await prisma.user.findUnique({
      where: { id: session.uid },
      select: { id: true, role: true, mustChangePassword: true, sessionVersion: true },
    })
    if (!user || user.sessionVersion !== session.v) throw new AppError(401, 'Session expirée, reconnectez-vous')
    if (user.mustChangePassword && !ALLOWED_WITH_TEMP_PASSWORD.has(`${req.method} ${req.path}`))
      throw new AppError(403, 'Changez votre mot de passe provisoire pour continuer')
    req.user = user
    next()
  } catch (err) { next(err) }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role !== 'ADMIN') return next(new AppError(403, 'Réservé aux administrateurs'))
  next()
}

/** Utilisateur connecté (les routes protégées passent toujours par requireAuth). */
export const currentUser = (req: Request) => {
  if (!req.user) throw new AppError(401, 'Connexion requise')
  return req.user
}
