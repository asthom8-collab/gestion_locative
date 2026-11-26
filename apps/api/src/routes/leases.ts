import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../middlewares/validate'
import { leasesController } from '../controllers/leases'
import { LeaseType } from '@prisma/client'

const router = Router()

const createSchema = z.object({
  propertyId: z.string().cuid(),
  tenantId: z.string().cuid(),
  type: z.nativeEnum(LeaseType),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  rentAmount: z.number().positive(),
  chargesAmount: z.number().min(0),
  rentDayOfMonth: z.number().int().min(1).max(28).optional(),
  irlReference: z.number().positive().optional(),
  irlQuarter: z.number().int().min(1).max(4).optional(),
  irlYear: z.number().int().min(2000).optional(),
  // Texte attendu dans le libellé du virement du locataire (rapprochement bancaire) ; null pour l'effacer
  bankLabel: z.string().trim().max(100).nullable().optional().transform((v) => (v === '' ? null : v)),
})

const updateSchema = createSchema.omit({ propertyId: true, tenantId: true }).partial()

const terminateSchema = z.object({
  endDate: z.string().datetime(),
})

router.get('/', leasesController.getAll)
router.get('/property/:propertyId', leasesController.getByProperty)
router.get('/:id', leasesController.getById)
router.post('/', validate(createSchema), leasesController.create)
router.patch('/:id', validate(updateSchema), leasesController.update)
router.post('/:id/terminate', validate(terminateSchema), leasesController.terminate)

export default router
