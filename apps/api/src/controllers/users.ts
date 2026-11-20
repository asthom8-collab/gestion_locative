import { Request, Response, NextFunction } from 'express'
import { usersService } from '../services/users'

export const usersController = {
  async directory(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await usersService.directory())
    } catch (err) { next(err) }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json(await usersService.createUser(req.body))
    } catch (err) { next(err) }
  },

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      await usersService.resetPassword(req.params.id, req.body.password)
      res.status(204).end()
    } catch (err) { next(err) }
  },
}
