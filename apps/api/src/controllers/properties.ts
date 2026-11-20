import { Request, Response, NextFunction } from 'express'
import { propertiesService } from '../services/properties'
import { currentUser } from '../middlewares/auth'

export const propertiesController = {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await propertiesService.getAll(currentUser(req).id)
      res.json(data)
    } catch (err) { next(err) }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await propertiesService.getById(req.params.id, currentUser(req).id)
      res.json(data)
    } catch (err) { next(err) }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await propertiesService.create({ ...req.body, userId: currentUser(req).id })
      res.status(201).json(data)
    } catch (err) { next(err) }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await propertiesService.update(req.params.id, currentUser(req).id, req.body)
      res.json(data)
    } catch (err) { next(err) }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await propertiesService.delete(req.params.id, currentUser(req).id)
      res.status(204).send()
    } catch (err) { next(err) }
  },

  async setOwners(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await propertiesService.setOwners(req.params.id, currentUser(req).id, req.body.owners))
    } catch (err) { next(err) }
  },
}
