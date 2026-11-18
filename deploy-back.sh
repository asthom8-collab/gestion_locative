#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# deploy-back.sh — Copie des fichiers back Axe 1
# À exécuter depuis ~/gestion-locative
# ═══════════════════════════════════════════════════════════════

set -e

API="./apps/api/src"

echo "📁 Création des dossiers manquants..."
mkdir -p $API/lib
mkdir -p $API/middlewares
mkdir -p $API/repositories
mkdir -p $API/services
mkdir -p $API/controllers
mkdir -p $API/routes

echo ""
echo "📄 Copie des fichiers..."

# ── index.ts (point d'entrée) ──────────────────────────────────
cat > $API/index.ts << 'EOF'
import express from 'express'
import { createLogger, transports, format } from 'winston'
import router from './routes'
import { errorHandler } from './middlewares/errorHandler'

const logger = createLogger({
  level: 'info',
  format: format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console()],
})

const app = express()
const PORT = process.env.PORT ?? 3001

app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api', router)

// Middleware d'erreur — doit être en dernier
app.use(errorHandler)

app.listen(PORT, () => {
  logger.info(`API démarrée sur le port ${PORT}`)
})
EOF
echo "  ✅ apps/api/src/index.ts"

# ── lib/ ───────────────────────────────────────────────────────
cat > $API/lib/prisma.ts << 'EOF'
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: ['error', 'warn'] })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
EOF
echo "  ✅ apps/api/src/lib/prisma.ts"

# ── middlewares/ ───────────────────────────────────────────────
cat > $API/middlewares/errorHandler.ts << 'EOF'
import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { createLogger, transports, format } from 'winston'

const logger = createLogger({
  level: 'error',
  format: format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console()],
})

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation échouée',
      details: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    })
    return
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message })
    return
  }

  logger.error('Erreur non gérée', { err })
  res.status(500).json({ error: 'Erreur interne du serveur' })
}
EOF
echo "  ✅ apps/api/src/middlewares/errorHandler.ts"

cat > $API/middlewares/validate.ts << 'EOF'
import { Request, Response, NextFunction } from 'express'
import { ZodSchema } from 'zod'

export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body)
      next()
    } catch (err) {
      next(err)
    }
  }
}
EOF
echo "  ✅ apps/api/src/middlewares/validate.ts"

# ── repositories/ ──────────────────────────────────────────────
cat > $API/repositories/properties.ts << 'EOF'
import { prisma } from '../lib/prisma'
import { FiscalRegime, PropertyType } from '@prisma/client'

export type CreatePropertyInput = {
  name: string
  address: string
  zipCode: string
  city: string
  type: PropertyType
  surface: number
  fiscalRegime: FiscalRegime
  irlQuarter: number
  userId: string
  share?: number
}

export type UpdatePropertyInput = Partial<Omit<CreatePropertyInput, 'userId' | 'share'>>

export const propertiesRepository = {
  findAll(userId: string) {
    return prisma.property.findMany({
      where: { ownerships: { some: { userId } } },
      include: {
        ownerships: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        leases: {
          where: { active: true },
          include: { tenant: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  },

  findById(id: string, userId: string) {
    return prisma.property.findFirst({
      where: { id, ownerships: { some: { userId } } },
      include: {
        ownerships: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        leases: { include: { tenant: true } },
      },
    })
  },

  create({ userId, share = 1.0, ...data }: CreatePropertyInput) {
    return prisma.property.create({
      data: {
        ...data,
        ownerships: { create: { userId, share } },
      },
      include: { ownerships: true },
    })
  },

  update(id: string, data: UpdatePropertyInput) {
    return prisma.property.update({ where: { id }, data })
  },

  delete(id: string) {
    return prisma.property.delete({ where: { id } })
  },
}
EOF
echo "  ✅ apps/api/src/repositories/properties.ts"

cat > $API/repositories/tenants.ts << 'EOF'
import { prisma } from '../lib/prisma'

export type CreateTenantInput = {
  firstName: string
  lastName: string
  email: string
  phone?: string
  iban?: string
}

export type UpdateTenantInput = Partial<CreateTenantInput>

export const tenantsRepository = {
  findAll() {
    return prisma.tenant.findMany({
      include: {
        leases: {
          where: { active: true },
          include: {
            property: { select: { id: true, name: true, city: true } },
          },
        },
      },
      orderBy: { lastName: 'asc' },
    })
  },

  findById(id: string) {
    return prisma.tenant.findUnique({
      where: { id },
      include: {
        leases: {
          include: {
            property: { select: { id: true, name: true, city: true } },
          },
        },
        documents: true,
      },
    })
  },

  create(data: CreateTenantInput) {
    return prisma.tenant.create({ data })
  },

  update(id: string, data: UpdateTenantInput) {
    return prisma.tenant.update({ where: { id }, data })
  },

  delete(id: string) {
    return prisma.tenant.delete({ where: { id } })
  },
}
EOF
echo "  ✅ apps/api/src/repositories/tenants.ts"

cat > $API/repositories/leases.ts << 'EOF'
import { prisma } from '../lib/prisma'
import { LeaseType } from '@prisma/client'

export type CreateLeaseInput = {
  propertyId: string
  tenantId: string
  type: LeaseType
  startDate: Date
  endDate?: Date
  rentAmount: number
  chargesAmount: number
  rentDayOfMonth?: number
  irlReference?: number
  irlQuarter?: number
  irlYear?: number
}

export type UpdateLeaseInput = Partial<Omit<CreateLeaseInput, 'propertyId' | 'tenantId'>>

export const leasesRepository = {
  findAll() {
    return prisma.lease.findMany({
      include: {
        property: { select: { id: true, name: true, address: true, city: true } },
        tenant: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { startDate: 'desc' },
    })
  },

  findByProperty(propertyId: string) {
    return prisma.lease.findMany({
      where: { propertyId },
      include: {
        tenant: { select: { id: true, firstName: true, lastName: true, email: true } },
        rentPayments: { orderBy: { periodYear: 'desc' }, take: 3 },
      },
      orderBy: { startDate: 'desc' },
    })
  },

  findById(id: string) {
    return prisma.lease.findUnique({
      where: { id },
      include: {
        property: true,
        tenant: true,
        rentPayments: {
          orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
        },
        documents: true,
        inventories: true,
      },
    })
  },

  create(data: CreateLeaseInput) {
    return prisma.lease.create({
      data,
      include: {
        property: { select: { id: true, name: true } },
        tenant: { select: { id: true, firstName: true, lastName: true } },
      },
    })
  },

  update(id: string, data: UpdateLeaseInput) {
    return prisma.lease.update({ where: { id }, data })
  },

  terminate(id: string, endDate: Date) {
    return prisma.lease.update({
      where: { id },
      data: { active: false, endDate },
    })
  },
}
EOF
echo "  ✅ apps/api/src/repositories/leases.ts"

# ── services/ ──────────────────────────────────────────────────
cat > $API/services/properties.ts << 'EOF'
import { propertiesRepository, CreatePropertyInput, UpdatePropertyInput } from '../repositories/properties'
import { AppError } from '../middlewares/errorHandler'

export const propertiesService = {
  async getAll(userId: string) {
    return propertiesRepository.findAll(userId)
  },

  async getById(id: string, userId: string) {
    const property = await propertiesRepository.findById(id, userId)
    if (!property) throw new AppError(404, 'Bien introuvable')
    return property
  },

  async create(data: CreatePropertyInput) {
    return propertiesRepository.create(data)
  },

  async update(id: string, userId: string, data: UpdatePropertyInput) {
    await propertiesService.getById(id, userId)
    return propertiesRepository.update(id, data)
  },

  async delete(id: string, userId: string) {
    const property = await propertiesService.getById(id, userId)
    const hasActiveLeases = property.leases.some((l) => l.active)
    if (hasActiveLeases)
      throw new AppError(409, 'Impossible de supprimer un bien avec un bail actif')
    return propertiesRepository.delete(id)
  },
}
EOF
echo "  ✅ apps/api/src/services/properties.ts"

cat > $API/services/tenants.ts << 'EOF'
import { tenantsRepository, CreateTenantInput, UpdateTenantInput } from '../repositories/tenants'
import { AppError } from '../middlewares/errorHandler'

export const tenantsService = {
  async getAll() {
    return tenantsRepository.findAll()
  },

  async getById(id: string) {
    const tenant = await tenantsRepository.findById(id)
    if (!tenant) throw new AppError(404, 'Locataire introuvable')
    return tenant
  },

  async create(data: CreateTenantInput) {
    return tenantsRepository.create(data)
  },

  async update(id: string, data: UpdateTenantInput) {
    await tenantsService.getById(id)
    return tenantsRepository.update(id, data)
  },

  async delete(id: string) {
    const tenant = await tenantsService.getById(id)
    const hasActiveLeases = tenant.leases.some((l) => l.active)
    if (hasActiveLeases)
      throw new AppError(409, 'Impossible de supprimer un locataire avec un bail actif')
    return tenantsRepository.delete(id)
  },
}
EOF
echo "  ✅ apps/api/src/services/tenants.ts"

cat > $API/services/leases.ts << 'EOF'
import { leasesRepository, CreateLeaseInput, UpdateLeaseInput } from '../repositories/leases'
import { AppError } from '../middlewares/errorHandler'
import { prisma } from '../lib/prisma'

export const leasesService = {
  async getAll() {
    return leasesRepository.findAll()
  },

  async getByProperty(propertyId: string) {
    return leasesRepository.findByProperty(propertyId)
  },

  async getById(id: string) {
    const lease = await leasesRepository.findById(id)
    if (!lease) throw new AppError(404, 'Bail introuvable')
    return lease
  },

  async create(data: CreateLeaseInput) {
    const existing = await prisma.lease.findFirst({
      where: { propertyId: data.propertyId, active: true },
    })
    if (existing) throw new AppError(409, 'Ce bien a déjà un bail actif')
    return leasesRepository.create(data)
  },

  async update(id: string, data: UpdateLeaseInput) {
    await leasesService.getById(id)
    return leasesRepository.update(id, data)
  },

  async terminate(id: string, endDate: Date) {
    const lease = await leasesService.getById(id)
    if (!lease.active) throw new AppError(409, 'Ce bail est déjà résilié')
    return leasesRepository.terminate(id, endDate)
  },
}
EOF
echo "  ✅ apps/api/src/services/leases.ts"

# ── controllers/ ───────────────────────────────────────────────
cat > $API/controllers/properties.ts << 'EOF'
import { Request, Response, NextFunction } from 'express'
import { propertiesService } from '../services/properties'

// userId hardcodé en attendant la brique auth — remplacé par req.user.id en Phase auth
const DEV_USER_ID = 'dev-user-placeholder'

export const propertiesController = {
  async getAll(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await propertiesService.getAll(DEV_USER_ID)
      res.json(data)
    } catch (err) { next(err) }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await propertiesService.getById(req.params.id, DEV_USER_ID)
      res.json(data)
    } catch (err) { next(err) }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await propertiesService.create({ ...req.body, userId: DEV_USER_ID })
      res.status(201).json(data)
    } catch (err) { next(err) }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await propertiesService.update(req.params.id, DEV_USER_ID, req.body)
      res.json(data)
    } catch (err) { next(err) }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await propertiesService.delete(req.params.id, DEV_USER_ID)
      res.status(204).send()
    } catch (err) { next(err) }
  },
}
EOF
echo "  ✅ apps/api/src/controllers/properties.ts"

cat > $API/controllers/tenants.ts << 'EOF'
import { Request, Response, NextFunction } from 'express'
import { tenantsService } from '../services/tenants'

export const tenantsController = {
  async getAll(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await tenantsService.getAll()
      res.json(data)
    } catch (err) { next(err) }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await tenantsService.getById(req.params.id)
      res.json(data)
    } catch (err) { next(err) }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await tenantsService.create(req.body)
      res.status(201).json(data)
    } catch (err) { next(err) }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await tenantsService.update(req.params.id, req.body)
      res.json(data)
    } catch (err) { next(err) }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await tenantsService.delete(req.params.id)
      res.status(204).send()
    } catch (err) { next(err) }
  },
}
EOF
echo "  ✅ apps/api/src/controllers/tenants.ts"

cat > $API/controllers/leases.ts << 'EOF'
import { Request, Response, NextFunction } from 'express'
import { leasesService } from '../services/leases'

export const leasesController = {
  async getAll(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await leasesService.getAll()
      res.json(data)
    } catch (err) { next(err) }
  },

  async getByProperty(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await leasesService.getByProperty(req.params.propertyId)
      res.json(data)
    } catch (err) { next(err) }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await leasesService.getById(req.params.id)
      res.json(data)
    } catch (err) { next(err) }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await leasesService.create({
        ...req.body,
        startDate: new Date(req.body.startDate),
        endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
      })
      res.status(201).json(data)
    } catch (err) { next(err) }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await leasesService.update(req.params.id, req.body)
      res.json(data)
    } catch (err) { next(err) }
  },

  async terminate(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await leasesService.terminate(
        req.params.id,
        new Date(req.body.endDate)
      )
      res.json(data)
    } catch (err) { next(err) }
  },
}
EOF
echo "  ✅ apps/api/src/controllers/leases.ts"

# ── routes/ ────────────────────────────────────────────────────
cat > $API/routes/properties.ts << 'EOF'
import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../middlewares/validate'
import { propertiesController } from '../controllers/properties'
import { FiscalRegime, PropertyType } from '@prisma/client'

const router = Router()

const createSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  zipCode: z.string().length(5),
  city: z.string().min(1),
  type: z.nativeEnum(PropertyType),
  surface: z.number().positive(),
  fiscalRegime: z.nativeEnum(FiscalRegime),
  irlQuarter: z.number().int().min(1).max(4),
  share: z.number().min(0.01).max(1).optional(),
})

const updateSchema = createSchema.partial()

router.get('/', propertiesController.getAll)
router.get('/:id', propertiesController.getById)
router.post('/', validate(createSchema), propertiesController.create)
router.patch('/:id', validate(updateSchema), propertiesController.update)
router.delete('/:id', propertiesController.delete)

export default router
EOF
echo "  ✅ apps/api/src/routes/properties.ts"

cat > $API/routes/tenants.ts << 'EOF'
import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../middlewares/validate'
import { tenantsController } from '../controllers/tenants'

const router = Router()

const createSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  iban: z.string().optional(),
})

const updateSchema = createSchema.partial()

router.get('/', tenantsController.getAll)
router.get('/:id', tenantsController.getById)
router.post('/', validate(createSchema), tenantsController.create)
router.patch('/:id', validate(updateSchema), tenantsController.update)
router.delete('/:id', tenantsController.delete)

export default router
EOF
echo "  ✅ apps/api/src/routes/tenants.ts"

cat > $API/routes/leases.ts << 'EOF'
import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../middlewares/validate'
import { leasesController } from '../controllers/leases'
import { LeaseType } from '@prisma/client'

const router = Router()

const createSchema = z.object({
  propertyId: z.string().cuid(),
  tenantId: z.string().cuid(),
  type: z.nativeEnum(LeaseType),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  rentAmount: z.number().positive(),
  chargesAmount: z.number().min(0),
  rentDayOfMonth: z.number().int().min(1).max(28).optional(),
  irlReference: z.number().positive().optional(),
  irlQuarter: z.number().int().min(1).max(4).optional(),
  irlYear: z.number().int().min(2000).optional(),
})

const updateSchema = createSchema.omit({ propertyId: true, tenantId: true }).partial()

const terminateSchema = z.object({
  endDate: z.string().datetime(),
})

router.get('/', leasesController.getAll)
router.get('/property/:propertyId', leasesController.getByProperty)
router.get('/:id', leasesController.getById)
router.post('/', validate(createSchema), leasesController.create)
router.patch('/:id', validate(updateSchema), leasesController.update)
router.post('/:id/terminate', validate(terminateSchema), leasesController.terminate)

export default router
EOF
echo "  ✅ apps/api/src/routes/leases.ts"

cat > $API/routes/index.ts << 'EOF'
import { Router } from 'express'
import propertiesRouter from './properties'
import tenantsRouter from './tenants'
import leasesRouter from './leases'

const router = Router()

router.use('/properties', propertiesRouter)
router.use('/tenants', tenantsRouter)
router.use('/leases', leasesRouter)

export default router
EOF
echo "  ✅ apps/api/src/routes/index.ts"

echo ""
echo "════════════════════════════════════════"
echo "✅ Tous les fichiers sont en place"
echo "════════════════════════════════════════"
echo ""
echo "Structure déployée :"
echo ""
echo "  apps/api/src/"
echo "  ├── index.ts"
echo "  ├── lib/"
echo "  │   └── prisma.ts"
echo "  ├── middlewares/"
echo "  │   ├── errorHandler.ts"
echo "  │   └── validate.ts"
echo "  ├── repositories/"
echo "  │   ├── properties.ts"
echo "  │   ├── tenants.ts"
echo "  │   └── leases.ts"
echo "  ├── services/"
echo "  │   ├── properties.ts"
echo "  │   ├── tenants.ts"
echo "  │   └── leases.ts"
echo "  ├── controllers/"
echo "  │   ├── properties.ts"
echo "  │   ├── tenants.ts"
echo "  │   └── leases.ts"
echo "  └── routes/"
echo "      ├── index.ts"
echo "      ├── properties.ts"
echo "      ├── tenants.ts"
echo "      └── leases.ts"
echo ""
echo "Lance ensuite : cd apps/api && npm run dev"
