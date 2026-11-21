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
})

const updateSchema = createSchema.partial()

// Copropriétaires : liste complète, quotes-parts entre 0 et 1 dont la somme vaut 1
const ownersSchema = z.object({
  owners: z.array(z.object({
    userId: z.string().min(1),
    share: z.number().gt(0).max(1),
    // Période de détention (AAAA-MM-JJ), facultative : changement de propriétaire en cours d'année
    startDate: z.coerce.date().nullable().optional(),
    endDate: z.coerce.date().nullable().optional(),
  })).min(1).max(40),
})

router.get('/', propertiesController.getAll)
router.get('/:id', propertiesController.getById)
router.post('/', validate(createSchema), propertiesController.create)
router.patch('/:id', validate(updateSchema), propertiesController.update)
router.delete('/:id', propertiesController.delete)
router.put('/:id/owners', validate(ownersSchema), propertiesController.setOwners)

export default router
