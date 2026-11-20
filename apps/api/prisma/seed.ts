import { PrismaClient, Role, PropertyType, FiscalRegime, LeaseType } from '@prisma/client'
import { hash } from 'bcrypt'
import { DEV_USER_ID } from '../src/lib/devUser'

const prisma = new PrismaClient()

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: 'admin@local.dev' },
    update: {},
    create: {
      id: DEV_USER_ID,
      email: 'admin@local.dev',
      passwordHash: await hash('changeme', 12),
      firstName: 'Thomas',
      lastName: 'Admin',
      role: Role.ADMIN,
    },
  })

  const property = await prisma.property.create({
    data: {
      name: 'T3 Lyon 3e',
      address: '12 rue de la République',
      zipCode: '69003',
      city: 'Lyon',
      type: PropertyType.APARTMENT,
      surface: 65,
      fiscalRegime: FiscalRegime.NU,
      irlQuarter: 2,
      ownerships: {
        create: { userId: admin.id, share: 1.0 },
      },
    },
  })

  const tenant = await prisma.tenant.create({
    data: {
      firstName: 'Jean',
      lastName: 'Dupont',
      email: 'jean.dupont@example.com',
      phone: '0601020304',
      createdById: admin.id,
    },
  })

  await prisma.lease.create({
    data: {
      propertyId: property.id,
      tenantId: tenant.id,
      type: LeaseType.UNFURNISHED,
      startDate: new Date('2023-07-01'),
      rentAmount: 850,
      chargesAmount: 80,
      rentDayOfMonth: 1,
      irlReference: 143.29,
      irlQuarter: 2,
      irlYear: 2023,
      active: true,
    },
  })

  console.log('✅ Seed terminé')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
