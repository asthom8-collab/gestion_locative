import { Request, Response, NextFunction } from 'express'
import { usersService } from '../services/users'
import { currentUser } from '../middlewares/auth'

export const usersController = {
  async directory(req: Request, res: Response, next: NextFunction) {
    try {
      const me = currentUser(req)
      res.json(await usersService.directory(me.id, me.role))
    } catch (err) { next(err) }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json(await usersService.createUser(req.body))
    } catch (err) { next(err) }
  },

  async setRole(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await usersService.setRole(currentUser(req).id, req.params.id, req.body.role))
    } catch (err) { next(err) }
  },

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      await usersService.resetPassword(req.params.id, req.body.password)
      res.status(204).end()
    } catch (err) { next(err) }
  },
}
