import { Request, Response, NextFunction } from 'express'
import { propertiesService } from '../services/properties'

// userId hardcodé en attendant la brique auth — remplacé par req.user.id en Phase auth
const DEV_USER_ID = 'cmqfofmui00009mbwcrd9flm8'

export const propertiesController = {
  async getAll(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await propertiesService.getAll(DEV_USER_ID)
      res.json(data)
    } catch (err) { next(err) }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await propertiesService.getById(req.params.id, DEV_USER_ID)
      res.json(data)
    } catch (err) { next(err) }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await propertiesService.create({ ...req.body, userId: DEV_USER_ID })
      res.status(201).json(data)
    } catch (err) { next(err) }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await propertiesService.update(req.params.id, DEV_USER_ID, req.body)
      res.json(data)
    } catch (err) { next(err) }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await propertiesService.delete(req.params.id, DEV_USER_ID)
      res.status(204).send()
    } catch (err) { next(err) }
  },
}
