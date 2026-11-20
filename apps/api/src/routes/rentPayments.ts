import { Router } from 'express'
import { z } from 'zod'
import { validate, validateQuery } from '../middlewares/validate'
import { rentPaymentsController } from '../controllers/rentPayments'

const router = Router()

const year = z.coerce.number().int().min(2000).max(2100)
const month = z.coerce.number().int().min(1).max(12)

const listSchema = z.object({
  year: year.optional(),
  month: month.optional(),
  leaseId: z.string().optional(),
})

const generateSchema = z.object({ year, month })

const paymentSchema = z.object({
  receivedAmount: z.number().positive(),
  paymentDate: z.string().datetime(),
})

router.get('/', validateQuery(listSchema), rentPaymentsController.list)
router.post('/generate', validate(generateSchema), rentPaymentsController.generate)
router.put('/:id/payment', validate(paymentSchema), rentPaymentsController.recordPayment)
router.delete('/:id/payment', rentPaymentsController.cancelPayment)
router.delete('/:id', rentPaymentsController.remove)
router.post('/:id/receipt', rentPaymentsController.generateReceipt)
router.get('/:id/receipt', rentPaymentsController.downloadReceipt)

export default router
