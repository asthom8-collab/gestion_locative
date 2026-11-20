import { Request, Response, NextFunction } from 'express'
import { leasesService } from '../services/leases'
import { currentUser } from '../middlewares/auth'

export const leasesController = {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await leasesService.getAll(currentUser(req).id)
      res.json(data)
    } catch (err) { next(err) }
  },

  async getByProperty(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await leasesService.getByProperty(req.params.propertyId, currentUser(req).id)
      res.json(data)
    } catch (err) { next(err) }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await leasesService.getById(req.params.id, currentUser(req).id)
      res.json(data)
    } catch (err) { next(err) }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await leasesService.create({
        ...req.body,
        startDate: new Date(req.body.startDate),
        endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
      }, currentUser(req).id)
      res.status(201).json(data)
    } catch (err) { next(err) }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await leasesService.update(req.params.id, currentUser(req).id, req.body)
      res.json(data)
    } catch (err) { next(err) }
  },

  async terminate(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await leasesService.terminate(
        req.params.id,
        currentUser(req).id,
        new Date(req.body.endDate)
      )
      res.json(data)
    } catch (err) { next(err) }
  },
}
