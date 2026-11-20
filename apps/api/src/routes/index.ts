import { Router } from 'express'
import propertiesRouter from './properties'
import tenantsRouter from './tenants'
import leasesRouter from './leases'
import rentPaymentsRouter from './rentPayments'
import meRouter from './me'
import authRouter from './auth'
import usersRouter from './users'
import { requireAuth } from '../middlewares/auth'

const router = Router()

// Seules la connexion et la déconnexion sont publiques
router.use('/auth', authRouter)
router.use(requireAuth)

router.use('/properties', propertiesRouter)
router.use('/tenants', tenantsRouter)
router.use('/leases', leasesRouter)
router.use('/rent-payments', rentPaymentsRouter)
router.use('/me', meRouter)
router.use('/users', usersRouter)

export default router
