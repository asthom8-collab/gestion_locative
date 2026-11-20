import { Request, Response, NextFunction } from 'express'
import { usersService } from '../services/users'
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from '../lib/auth'

export const authController = {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await usersService.authenticate(req.body.email, req.body.password)
      res.cookie(SESSION_COOKIE, createSessionToken(user.id, user.sessionVersion), sessionCookieOptions())
      res.json(await usersService.getProfile(user.id))
    } catch (err) { next(err) }
  },

  logout(_req: Request, res: Response) {
    const { maxAge: _ignored, ...options } = sessionCookieOptions()
    res.clearCookie(SESSION_COOKIE, options)
    res.status(204).end()
  },
}
