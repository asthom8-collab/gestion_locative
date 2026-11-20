import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../middlewares/validate'
import { meController } from '../controllers/me'

const router = Router()

// Chaîne vide → null, pour pouvoir effacer un champ depuis un formulaire
const optionalText = z.string().trim().max(200).transform((s) => (s === '' ? null : s)).nullable().optional()

const updateSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  address: optionalText,
  zipCode: optionalText,
  city: optionalText,
})

router.get('/', meController.get)
router.patch('/', validate(updateSchema), meController.update)

export default router
