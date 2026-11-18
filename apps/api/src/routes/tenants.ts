import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../middlewares/validate'
import { tenantsController } from '../controllers/tenants'

const router = Router()

const createSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  iban: z.string().optional(),
})

const updateSchema = createSchema.partial()

router.get('/', tenantsController.getAll)
router.get('/:id', tenantsController.getById)
router.post('/', validate(createSchema), tenantsController.create)
router.patch('/:id', validate(updateSchema), tenantsController.update)
router.delete('/:id', tenantsController.delete)

export default router
