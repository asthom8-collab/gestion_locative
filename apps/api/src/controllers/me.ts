import { Request, Response, NextFunction } from 'express'
import { usersService } from '../services/users'
import { DEV_USER_ID } from '../lib/devUser'

export const meController = {
  async get(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await usersService.getProfile(DEV_USER_ID))
    } catch (err) { next(err) }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await usersService.updateProfile(DEV_USER_ID, req.body))
    } catch (err) { next(err) }
  },
}
