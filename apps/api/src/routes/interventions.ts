import { Router } from 'express'
import { z } from 'zod'
import { InterventionDoneBy, InterventionKind, InterventionNature, InterventionPayer, InterventionStatus } from '@prisma/client'
import { validate, validateQuery } from '../middlewares/validate'
import { handle } from '../controllers/handle'
import { currentUser } from '../middlewares/auth'
import { interventionsService } from '../services/interventions'

// Interventions (travaux) sur un bien, faites par le propriétaire ou par un professionnel
const router = Router()

const kind = z.nativeEnum(InterventionKind)
const createSchema = z.object({
  propertyId: z.string().min(1),
  leaseId: z.string().min(1).nullable().optional(),
  title: z.string().trim().min(1).max(160),
  kind,
  date: z.string().datetime(),
  status: z.nativeEnum(InterventionStatus).optional(),
  doneBy: z.nativeEnum(InterventionDoneBy).optional(),
  providerName: z.string().max(160).nullable().optional(),
  cost: z.number().min(0).max(10_000_000),
  paidBy: z.nativeEnum(InterventionPayer).optional(),
  fiscalNature: z.nativeEnum(InterventionNature).optional(),
  notes: z.string().max(4000).nullable().optional(),
})
const updateSchema = createSchema.omit({ propertyId: true }).partial()
const listSchema = z.object({
  propertyId: z.string().optional(),
  leaseId: z.string().optional(),
  kind: kind.optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
})

router.get('/', validateQuery(listSchema), handle(async (req, res) => {
  res.json(await interventionsService.list({ userId: currentUser(req).id, ...(req.query as z.infer<typeof listSchema>) }))
}))
router.get('/:id', handle(async (req, res) => {
  res.json(await interventionsService.get(req.params.id, currentUser(req).id))
}))
router.post('/', validate(createSchema), handle(async (req, res) => {
  res.status(201).json(await interventionsService.create(currentUser(req).id, req.body))
}))
router.patch('/:id', validate(updateSchema), handle(async (req, res) => {
  res.json(await interventionsService.update(req.params.id, currentUser(req).id, req.body))
}))
router.delete('/:id', handle(async (req, res) => {
  await interventionsService.remove(req.params.id, currentUser(req).id)
  res.status(204).end()
}))

export default router
