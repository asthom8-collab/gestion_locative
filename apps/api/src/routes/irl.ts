import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../middlewares/validate'
import { handle } from '../controllers/handle'
import { irlRepository } from '../repositories/irl'

// Indices de référence des loyers (INSEE), saisis à la main ; communs à tous les utilisateurs
const router = Router()

const upsertSchema = z.object({
  quarter: z.number().int().min(1).max(4),
  year: z.number().int().min(2000).max(2100),
  value: z.number().positive().max(1000),
})

router.get('/', handle(async (_req, res) => { res.json(await irlRepository.findAll()) }))
router.put('/', validate(upsertSchema), handle(async (req, res) => {
  const { quarter, year, value } = req.body
  res.json(await irlRepository.upsert(quarter, year, value))
}))

export default router
