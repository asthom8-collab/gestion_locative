import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../middlewares/validate'
import { requireAdmin } from '../middlewares/auth'
import { usersController } from '../controllers/users'

const router = Router()

export const passwordSchema = z.string().min(8, 'Le mot de passe doit faire au moins 8 caractères').max(200)

const createSchema = z.object({
  email: z.string().trim().email(),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  password: passwordSchema,
  role: z.enum(['ADMIN', 'USER']).optional(),
})

// Annuaire (id, nom, e-mail) : pour choisir les copropriétaires d'un bien
router.get('/', usersController.directory)
router.post('/', requireAdmin, validate(createSchema), usersController.create)
router.put('/:id/password', requireAdmin, validate(z.object({ password: passwordSchema })), usersController.resetPassword)

export default router
