import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../middlewares/validate'
import { propertiesController } from '../controllers/properties'
import { FiscalRegime, PropertyType } from '@prisma/client'

const router = Router()

const createSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  zipCode: z.string().length(5),
  city: z.string().min(1),
  type: z.nativeEnum(PropertyType),
  surface: z.number().positive(),
  fiscalRegime: z.nativeEnum(FiscalRegime),
  irlQuarter: z.number().int().min(1).max(4),
  share: z.number().min(0.01).max(1).optional(),
})

const updateSchema = createSchema.partial()

router.get('/', propertiesController.getAll)
router.get('/:id', propertiesController.getById)
router.post('/', validate(createSchema), propertiesController.create)
router.patch('/:id', validate(updateSchema), propertiesController.update)
router.delete('/:id', propertiesController.delete)

export default router
