import { Request, Response, NextFunction } from 'express'
import { tenantsService } from '../services/tenants'

export const tenantsController = {
  async getAll(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await tenantsService.getAll()
      res.json(data)
    } catch (err) { next(err) }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await tenantsService.getById(req.params.id)
      res.json(data)
    } catch (err) { next(err) }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await tenantsService.create(req.body)
      res.status(201).json(data)
    } catch (err) { next(err) }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await tenantsService.update(req.params.id, req.body)
      res.json(data)
    } catch (err) { next(err) }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await tenantsService.delete(req.params.id)
      res.status(204).send()
    } catch (err) { next(err) }
  },
}
