import { Request, Response, NextFunction } from 'express'
import { usersService } from '../services/users'
import { currentUser } from '../middlewares/auth'
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from '../lib/auth'
import { AppError } from '../middlewares/errorHandler'

export const meController = {
  async get(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await usersService.getProfile(currentUser(req).id))
    } catch (err) { next(err) }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await usersService.updateProfile(currentUser(req).id, req.body))
    } catch (err) { next(err) }
  },

  /** Les autres sessions sont fermées ; celle-ci reçoit un nouveau cookie. */
  async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = currentUser(req)
      const { sessionVersion } = await usersService.changePassword(id, req.body.currentPassword, req.body.newPassword)
      res.cookie(SESSION_COOKIE, createSessionToken(id, sessionVersion), sessionCookieOptions())
      res.json(await usersService.getProfile(id))
    } catch (err) { next(err) }
  },

  async setSignature(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await usersService.setSignature(currentUser(req).id, req.body.image))
    } catch (err) { next(err) }
  },

  async deleteSignature(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await usersService.deleteSignature(currentUser(req).id))
    } catch (err) { next(err) }
  },

  async getSignature(req: Request, res: Response, next: NextFunction) {
    try {
      const path = await usersService.signatureFile(currentUser(req).id)
      res.setHeader('Cache-Control', 'no-store')
      res.sendFile(path, (err) => {
        if (err && !res.headersSent) next(new AppError(404, 'Fichier de signature introuvable'))
      })
    } catch (err) { next(err) }
  },
}
