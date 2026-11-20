import { Router } from 'express'
import propertiesRouter from './properties'
import tenantsRouter from './tenants'
import leasesRouter from './leases'
import rentPaymentsRouter from './rentPayments'
import meRouter from './me'

const router = Router()

router.use('/properties', propertiesRouter)
router.use('/tenants', tenantsRouter)
router.use('/leases', leasesRouter)
router.use('/rent-payments', rentPaymentsRouter)
router.use('/me', meRouter)

export default router
