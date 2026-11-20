import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../middlewares/validate'
import { authController } from '../controllers/auth'

const router = Router()

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(200),
})

router.post('/login', validate(loginSchema), authController.login)
router.post('/logout', authController.logout)

export default router
