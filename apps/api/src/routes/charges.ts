import { Router } from 'express'
import { z } from 'zod'
import { validate, validateQuery } from '../middlewares/validate'
import { handle } from '../controllers/handle'
import { currentUser } from '../middlewares/auth'
import { chargesService } from '../services/charges'

// Charges récupérables réelles d'un bien, par année ou par trimestre (base de la régularisation)
const router = Router()

const year = z.number().int().min(2000).max(2100)
// quarter : trimestre (1 à 4), ou null / absent pour une charge de l'année entière
const createSchema = z.object({
  propertyId: z.string().min(1), year, quarter: z.number().int().min(1).max(4).nullable().optional(),
  label: z.string().trim().min(1).max(120), amount: z.number().positive(),
})
const updateSchema = createSchema.omit({ propertyId: true }).partial()
const listSchema = z.object({ year: z.coerce.number().int().min(2000).max(2100).optional(), propertyId: z.string().optional() })

router.get('/', validateQuery(listSchema), handle(async (req, res) => {
  res.json(await chargesService.list(currentUser(req).id, req.query as { year?: number; propertyId?: string }))
}))
// Répartition des charges d'une année entre les propriétaires successifs (quotes-parts datées)
router.get('/allocation', validateQuery(z.object({ year: z.coerce.number().int().min(2000).max(2100) })), handle(async (req, res) => {
  res.json(await chargesService.allocation(currentUser(req).id, Number(req.query.year)))
}))
// Régularisations enregistrées qui ne correspondent plus aux charges ou aux provisions (alerte du tableau de bord)
router.get('/outdated-regularizations', handle(async (req, res) => {
  res.json(await chargesService.outdatedRegularizations(currentUser(req).id))
}))
router.post('/', validate(createSchema), handle(async (req, res) => {
  res.status(201).json(await chargesService.create(currentUser(req).id, req.body))
}))
router.patch('/:id', validate(updateSchema), handle(async (req, res) => {
  res.json(await chargesService.update(req.params.id, currentUser(req).id, req.body))
}))
router.delete('/:id', handle(async (req, res) => {
  await chargesService.remove(req.params.id, currentUser(req).id)
  res.status(204).end()
}))

export default router
