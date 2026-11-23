/**
 * Exemple de régularisation à refaire, dans la base de DATABASE_URL (dev ou test à distance) :
 * un bien « Démo régularisation » au premier administrateur, un bail 2025, les échéances 2025, des charges,
 * la régularisation 2025 enregistrée, puis une charge modifiée après coup → alerte (tableau de bord, Charges,
 * fiche du bail, cloche). Ne touche à aucune autre donnée ; ne fait rien si le bien existe déjà.
 *   npm run demo:regularisation
 */
import { PrismaClient } from '@prisma/client'
import { chargesService, regularizationsService } from '../src/services/charges'

const prisma = new PrismaClient()
const NAME = 'Démo régularisation'

async function main() {
  const admin = await prisma.user.findFirstOrThrow({ where: { role: 'ADMIN' }, orderBy: { createdAt: 'asc' } })
  if (await prisma.property.findFirst({ where: { name: NAME, ownerships: { some: { userId: admin.id } } } })) {
    console.log(`« ${NAME} » existe déjà : rien à faire (supprimez le bien pour recommencer).`)
    return
  }
  const property = await prisma.property.create({ data: {
    name: NAME, address: '1 rue de l’Exemple', zipCode: '69001', city: 'Lyon', type: 'APARTMENT', surface: 30, fiscalRegime: 'NU', irlQuarter: 2,
    ownerships: { create: { userId: admin.id, share: 1 } },
  } })
  const tenant = await prisma.tenant.create({ data: { firstName: 'Camille', lastName: 'Exemple', email: 'camille@example.com', createdById: admin.id } })
  const lease = await prisma.lease.create({ data: {
    propertyId: property.id, tenantId: tenant.id, type: 'UNFURNISHED', startDate: new Date('2025-01-01'),
    rentAmount: 600, chargesAmount: 40, rentDayOfMonth: 1, active: true,
  } })
  for (let m = 1; m <= 12; m++) {
    await prisma.rentPayment.create({ data: {
      leaseId: lease.id, periodYear: 2025, periodMonth: m,
      periodStart: new Date(Date.UTC(2025, m - 1, 1)), periodEnd: new Date(Date.UTC(2025, m, 0)),
      rentAmount: 600, chargesAmount: 40, expectedAmount: 640, receivedAmount: 640,
      paymentDate: new Date(Date.UTC(2025, m - 1, 3)), status: 'RECEIVED',
    } })
  }
  const water = await chargesService.create(admin.id, { propertyId: property.id, year: 2025, quarter: null, label: 'Eau froide et chaude', amount: 360 })
  await chargesService.create(admin.id, { propertyId: property.id, year: 2025, quarter: null, label: 'Taxe d’enlèvement des ordures ménagères', amount: 180 })
  const reg = await regularizationsService.create(lease.id, admin.id, 2025)
  // Facture d'eau rectifiée après l'enregistrement de la régularisation
  await chargesService.update(water.id, admin.id, { amount: 450 })
  console.log(`✅ ${NAME} : régularisation 2025 enregistrée (solde ${reg.balance} €), puis eau passée de 360 à 450 € → régularisation à refaire.`)
}

main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
