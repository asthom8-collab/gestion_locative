import express, { Router } from 'express'
import { z } from 'zod'
import { TransactionStatus } from '@prisma/client'
import { validate, validateQuery } from '../middlewares/validate'
import { handle } from '../controllers/handle'
import { currentUser } from '../middlewares/auth'
import { MAX_STATEMENT_BYTES, bankService } from '../services/bank'
import { bankConnectionService } from '../services/bankConnection'

// Rapprochement bancaire : comptes, import de relevés CSV, opérations et leur rapprochement avec les loyers
export const bankAccountsRouter = Router()
export const bankTransactionsRouter = Router()

const accountSchema = z.object({ name: z.string().trim().min(1).max(100) })

bankAccountsRouter.get('/', handle(async (req, res) => {
  res.json(await bankService.listAccounts(currentUser(req).id))
}))

bankAccountsRouter.post('/', validate(accountSchema), handle(async (req, res) => {
  res.status(201).json(await bankService.createAccount(currentUser(req).id, req.body.name))
}))

bankAccountsRouter.patch('/:id', validate(accountSchema), handle(async (req, res) => {
  res.json(await bankService.updateAccount(req.params.id, currentUser(req).id, req.body.name))
}))

bankAccountsRouter.delete('/:id', handle(async (req, res) => {
  await bankService.deleteAccount(req.params.id, currentUser(req).id)
  res.status(204).end()
}))

// Le relevé est envoyé brut dans le corps de la requête
bankAccountsRouter.post('/:id/import', express.raw({ type: () => true, limit: MAX_STATEMENT_BYTES }), handle(async (req, res) => {
  const content = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0)
  res.status(201).json(await bankService.importCsv(req.params.id, currentUser(req).id, content))
}))

// Connexion automatique à la banque (Enable Banking)
export const bankConnectionRouter = Router()

bankConnectionRouter.get('/banks', handle(async (_req, res) => {
  res.json(await bankConnectionService.banks())
}))

bankAccountsRouter.post('/:id/connect', validate(z.object({ bankName: z.string().min(1).max(200) })), handle(async (req, res) => {
  res.json(await bankConnectionService.start(req.params.id, currentUser(req).id, req.body.bankName))
}))

bankAccountsRouter.post('/:id/connect/complete', validate(z.object({ returnUrl: z.string().min(1).max(4000) })), handle(async (req, res) => {
  res.json(await bankConnectionService.complete(req.params.id, currentUser(req).id, req.body.returnUrl))
}))

bankAccountsRouter.put('/:id/connect/account', validate(z.object({ uid: z.string().min(1).max(200) })), handle(async (req, res) => {
  res.json(await bankConnectionService.chooseAccount(req.params.id, currentUser(req).id, req.body.uid))
}))

bankAccountsRouter.delete('/:id/connect', handle(async (req, res) => {
  res.json(await bankConnectionService.disconnect(req.params.id, currentUser(req).id))
}))

bankAccountsRouter.post('/:id/sync', handle(async (req, res) => {
  res.json(await bankConnectionService.sync(req.params.id, currentUser(req).id))
}))

const listSchema = z.object({
  accountId: z.string().optional(),
  status: z.nativeEnum(TransactionStatus).optional(),
  direction: z.enum(['credit', 'debit']).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
})

const matchSchema = z.object({
  allocations: z.array(z.object({ rentPaymentId: z.string().min(1), amount: z.number().positive() })).min(1).max(12),
})

const statusSchema = z.object({ status: z.enum(['IGNORED', 'UNMATCHED']) })

bankTransactionsRouter.get('/', validateQuery(listSchema), handle(async (req, res) => {
  res.json(await bankService.listTransactions({ userId: currentUser(req).id, ...(req.query as z.infer<typeof listSchema>) }))
}))

bankTransactionsRouter.post('/:id/match', validate(matchSchema), handle(async (req, res) => {
  res.json(await bankService.match(req.params.id, currentUser(req).id, req.body.allocations))
}))

bankTransactionsRouter.delete('/:id/match', handle(async (req, res) => {
  res.json(await bankService.unmatch(req.params.id, currentUser(req).id))
}))

bankTransactionsRouter.put('/:id/status', validate(statusSchema), handle(async (req, res) => {
  res.json(await bankService.setStatus(req.params.id, currentUser(req).id, req.body.status))
}))
