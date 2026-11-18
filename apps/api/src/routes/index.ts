import { Router } from 'express'
import propertiesRouter from './properties'
import tenantsRouter from './tenants'
import leasesRouter from './leases'

const router = Router()

router.use('/properties', propertiesRouter)
router.use('/tenants', tenantsRouter)
router.use('/leases', leasesRouter)

export default router
