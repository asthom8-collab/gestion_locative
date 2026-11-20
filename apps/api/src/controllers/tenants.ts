import { Request, Response, NextFunction } from 'express'
import { tenantsService } from '../services/tenants'
import { currentUser } from '../middlewares/auth'

export const tenantsController = {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await tenantsService.getAll(currentUser(req).id)
      res.json(data)
    } catch (err) { next(err) }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await tenantsService.getById(req.params.id, currentUser(req).id)
      res.json(data)
    } catch (err) { next(err) }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await tenantsService.create(req.body, currentUser(req).id)
      res.status(201).json(data)
    } catch (err) { next(err) }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await tenantsService.update(req.params.id, currentUser(req).id, req.body)
      res.json(data)
    } catch (err) { next(err) }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await tenantsService.delete(req.params.id, currentUser(req).id)
      res.status(204).send()
    } catch (err) { next(err) }
  },
}
