import { Router } from 'express'
import propertiesRouter from './properties'
import tenantsRouter from './tenants'
import leasesRouter from './leases'
import rentPaymentsRouter from './rentPayments'
import meRouter from './me'
import authRouter from './auth'
import usersRouter from './users'
import irlRouter from './irl'
import chargesRouter from './charges'
import leaseDocumentsRouter from './leaseDocuments'
import notificationsRouter from './notifications'
import documentsRouter from './documents'
import { bankAccountsRouter, bankConnectionRouter, bankTransactionsRouter } from './bank'
import { requireAuth } from '../middlewares/auth'

const router = Router()

// Seules la connexion et la déconnexion sont publiques
router.use('/auth', authRouter)
router.use(requireAuth)

router.use('/properties', propertiesRouter)
router.use('/tenants', tenantsRouter)
router.use('/leases/:id', leaseDocumentsRouter)
router.use('/leases', leasesRouter)
router.use('/rent-payments', rentPaymentsRouter)
router.use('/me', meRouter)
router.use('/users', usersRouter)
router.use('/irl', irlRouter)
router.use('/charges', chargesRouter)
router.use('/notifications', notificationsRouter)
router.use('/documents', documentsRouter)
router.use('/bank-accounts', bankAccountsRouter)
router.use('/bank-transactions', bankTransactionsRouter)
router.use('/bank-connection', bankConnectionRouter)

export default router
