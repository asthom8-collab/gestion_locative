import { Request, Response, NextFunction } from 'express'
import { leasesService } from '../services/leases'

export const leasesController = {
  async getAll(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await leasesService.getAll()
      res.json(data)
    } catch (err) { next(err) }
  },

  async getByProperty(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await leasesService.getByProperty(req.params.propertyId)
      res.json(data)
    } catch (err) { next(err) }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await leasesService.getById(req.params.id)
      res.json(data)
    } catch (err) { next(err) }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await leasesService.create({
        ...req.body,
        startDate: new Date(req.body.startDate),
        endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
      })
      res.status(201).json(data)
    } catch (err) { next(err) }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await leasesService.update(req.params.id, req.body)
      res.json(data)
    } catch (err) { next(err) }
  },

  async terminate(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await leasesService.terminate(
        req.params.id,
        new Date(req.body.endDate)
      )
      res.json(data)
    } catch (err) { next(err) }
  },
}
