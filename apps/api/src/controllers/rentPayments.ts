import { Request, Response, NextFunction } from 'express'
import { rentPaymentsService } from '../services/rentPayments'
import { AppError } from '../middlewares/errorHandler'
import { currentUser } from '../middlewares/auth'

export const rentPaymentsController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { year, month, leaseId } = req.query as { year?: number; month?: number; leaseId?: string }
      res.json(await rentPaymentsService.list({ userId: currentUser(req).id, year, month, leaseId }))
    } catch (err) { next(err) }
  },

  async generate(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await rentPaymentsService.generate(currentUser(req).id, req.body.year, req.body.month)
      res.status(data.created > 0 ? 201 : 200).json(data)
    } catch (err) { next(err) }
  },

  async recordPayment(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await rentPaymentsService.recordPayment(
        req.params.id,
        currentUser(req).id,
        req.body.receivedAmount,
        new Date(req.body.paymentDate)
      ))
    } catch (err) { next(err) }
  },

  async cancelPayment(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await rentPaymentsService.cancelPayment(req.params.id, currentUser(req).id))
    } catch (err) { next(err) }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await rentPaymentsService.remove(req.params.id, currentUser(req).id)
      res.status(204).end()
    } catch (err) { next(err) }
  },

  async generateReceipt(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json(await rentPaymentsService.generateReceipt(req.params.id, currentUser(req).id))
    } catch (err) { next(err) }
  },

  async downloadReceipt(req: Request, res: Response, next: NextFunction) {
    try {
      const file = await rentPaymentsService.getReceiptFile(req.params.id, currentUser(req).id)
      const inline = req.query.download === undefined
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${file.downloadName}"`)
      res.sendFile(file.path, (err) => {
        if (err && !res.headersSent) next(new AppError(404, 'Fichier de quittance introuvable'))
      })
    } catch (err) { next(err) }
  },
}
