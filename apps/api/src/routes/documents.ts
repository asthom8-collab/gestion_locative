import express, { Router } from 'express'
import { z } from 'zod'
import { DocumentCategory } from '@prisma/client'
import { validate, validateQuery } from '../middlewares/validate'
import { handle } from '../controllers/handle'
import { currentUser } from '../middlewares/auth'
import { MAX_DOCUMENT_BYTES, documentsService } from '../services/documents'

// Documents d'un bail ou d'un bien (contrat, états des lieux, assurance, diagnostics, factures…)
const router = Router()

const category = z.nativeEnum(DocumentCategory)
const listSchema = z.object({ leaseId: z.string().optional(), propertyId: z.string().optional(), category: category.optional() })
// Le fichier est envoyé brut dans le corps (Content-Type : son type) ; les métadonnées passent dans l'URL
const uploadSchema = z.object({
  leaseId: z.string().min(1).optional(),
  propertyId: z.string().min(1).optional(),
  category,
  fileName: z.string().min(1).max(255),
  label: z.string().max(200).optional(),
})
const updateSchema = z.object({ label: z.string().trim().min(1).max(200).optional(), category: category.optional() })

/** En-tête Content-Disposition avec un nom de fichier accentué (RFC 6266). */
function disposition(inline: boolean, fileName: string) {
  const ascii = fileName.normalize('NFD').replace(/[^\x20-\x7e]/g, '').replace(/["\\]/g, '') || 'document'
  return `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
}

router.get('/', validateQuery(listSchema), handle(async (req, res) => {
  res.json(await documentsService.list({ userId: currentUser(req).id, ...(req.query as z.infer<typeof listSchema>) }))
}))

router.post('/', express.raw({ type: () => true, limit: MAX_DOCUMENT_BYTES }), validateQuery(uploadSchema), handle(async (req, res) => {
  const q = req.query as z.infer<typeof uploadSchema>
  const doc = await documentsService.upload({
    userId: currentUser(req).id, ...q,
    mimeType: (req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase(),
    content: Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0),
  })
  res.status(201).json(doc)
}))

router.patch('/:id', validate(updateSchema), handle(async (req, res) => {
  res.json(await documentsService.update(req.params.id, currentUser(req).id, req.body))
}))

router.get('/:id/file', handle(async (req, res) => {
  const file = await documentsService.file(req.params.id, currentUser(req).id)
  const inline = file.inline && req.query.download === undefined
  res.setHeader('Content-Type', file.mimeType)
  res.setHeader('Content-Disposition', disposition(inline, file.fileName))
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Cache-Control', 'private, no-store')
  res.sendFile(file.path, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: 'Fichier introuvable' })
  })
}))

router.delete('/:id', handle(async (req, res) => {
  await documentsService.remove(req.params.id, currentUser(req).id)
  res.status(204).end()
}))

export default router
