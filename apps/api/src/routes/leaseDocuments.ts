import { Router } from 'express'
import { z } from 'zod'
import { validate, validateQuery } from '../middlewares/validate'
import { handle, sendPdf } from '../controllers/handle'
import { currentUser } from '../middlewares/auth'
import { revisionsService } from '../services/revisions'
import { regularizationsService } from '../services/charges'

// Sous-ressources d'un bail : révisions IRL du loyer et régularisations des charges
const router = Router({ mergeParams: true })
const uid = (req: Parameters<typeof currentUser>[0]) => currentUser(req).id

const applySchema = z.object({ effectiveDate: z.string().datetime(), newRent: z.number().positive().optional() })
const yearBody = z.object({ year: z.number().int().min(2000).max(2100) })
const yearQuery = z.object({ year: z.coerce.number().int().min(2000).max(2100) })

router.get('/revisions', handle(async (req, res) => { res.json(await revisionsService.list(req.params.id, uid(req))) }))
router.get('/revisions/preview', validateQuery(z.object({ date: z.string().datetime().optional() })), handle(async (req, res) => {
  res.json(await revisionsService.preview(req.params.id, uid(req), req.query.date ? new Date(String(req.query.date)) : undefined))
}))
router.post('/revisions', validate(applySchema), handle(async (req, res) => {
  res.status(201).json(await revisionsService.apply(req.params.id, uid(req), { effectiveDate: new Date(req.body.effectiveDate), newRent: req.body.newRent }))
}))
router.delete('/revisions/:rid', handle(async (req, res) => {
  await revisionsService.cancel(req.params.id, req.params.rid, uid(req))
  res.status(204).end()
}))
router.get('/revisions/:rid/letter', handle(async (req, res) => {
  const { pdf, fileName } = await revisionsService.letter(req.params.id, req.params.rid, uid(req))
  sendPdf(req, res, pdf, fileName)
}))

router.get('/regularizations', handle(async (req, res) => { res.json(await regularizationsService.list(req.params.id, uid(req))) }))
router.get('/regularizations/preview', validateQuery(yearQuery), handle(async (req, res) => {
  res.json(await regularizationsService.preview(req.params.id, uid(req), Number(req.query.year)))
}))
router.post('/regularizations', validate(yearBody), handle(async (req, res) => {
  res.status(201).json(await regularizationsService.create(req.params.id, uid(req), req.body.year))
}))
router.delete('/regularizations/:rid', handle(async (req, res) => {
  await regularizationsService.remove(req.params.id, req.params.rid, uid(req))
  res.status(204).end()
}))
router.get('/regularizations/:rid/statement', handle(async (req, res) => {
  const { pdf, fileName } = await regularizationsService.statement(req.params.id, req.params.rid, uid(req))
  sendPdf(req, res, pdf, fileName)
}))

export default router
