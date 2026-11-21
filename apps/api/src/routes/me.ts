import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../middlewares/validate'
import { meController } from '../controllers/me'
import { passwordSchema } from './users'

const router = Router()

// Chaîne vide → null, pour pouvoir effacer un champ depuis un formulaire
const optionalText = z.string().trim().max(200).transform((s) => (s === '' ? null : s)).nullable().optional()

const updateSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  address: optionalText,
  zipCode: optionalText,
  city: optionalText,
  // Notifications (délai avant l'anniversaire des baux, canaux)
  notifyDaysBefore: z.number().int().min(1).max(180).optional(),
  notifyEmail: z.boolean().optional(),
  ntfyTopic: z.string().trim().max(200).regex(/^(|[A-Za-z0-9_-]+|https:\/\/\S+)$/, 'Sujet ntfy : lettres, chiffres, - et _, ou adresse https complète')
    .transform((s) => (s === '' ? null : s)).nullable().optional(),
  freeMobileUser: optionalText,
  freeMobileKey: optionalText,
})

const passwordChangeSchema = z.object({ currentPassword: z.string().min(1).max(200), newPassword: passwordSchema })

// Image en data URL ; la limite de taille du corps JSON est relevée pour cette route (voir app.ts)
const signatureSchema = z.object({ image: z.string().max(450_000) })

router.get('/', meController.get)
router.patch('/', validate(updateSchema), meController.update)
router.put('/password', validate(passwordChangeSchema), meController.changePassword)
router.get('/signature', meController.getSignature)
router.put('/signature', validate(signatureSchema), meController.setSignature)
router.delete('/signature', meController.deleteSignature)

export default router
