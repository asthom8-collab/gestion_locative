/**
 * Données de démonstration du rapprochement bancaire, dans la base de DATABASE_URL (dev ou test à distance).
 * Crée au premier administrateur un bien « Démo banque » loué à deux locataires fictifs, leurs échéances des trois
 * derniers mois, et un compte « Démo — compte commun » avec des opérations couvrant les cas à traiter :
 * virement déjà rapproché, virements reconnus par le libellé du bail (validables en bloc), virement groupé sur deux mois,
 * paiement partiel, crédit sans rapport (à ignorer) et quelques débits.
 * Ne touche à aucune autre donnée ; ne fait rien si le bien existe déjà.
 *   npm run demo:banque
 *   npm run demo:banque -- --supprimer    (retire ces données de démonstration)
 */
import { PrismaClient } from '@prisma/client'
import { computeMonthlyDue } from '../src/lib/period'

const prisma = new PrismaClient()
const NAME = 'Démo banque'
const ACCOUNT = 'Démo — compte commun'

/** Les trois mois qui précèdent le mois en cours, du plus ancien au plus récent. */
function lastMonths() {
  const now = new Date()
  return [3, 2, 1].map((back) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1))
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 }
  })
}
const day = (m: { year: number; month: number }, d: number) => new Date(Date.UTC(m.year, m.month - 1, d))

async function create(adminId: string) {
  const months = lastMonths()
  const start = day(months[0], 1)
  const property = await prisma.property.create({ data: {
    name: NAME, address: '3 rue de l’Exemple', zipCode: '69007', city: 'Lyon', type: 'HOUSE', surface: 110, fiscalRegime: 'NU', irlQuarter: 1,
    ownerships: { create: { userId: adminId, share: 1 } },
  } })
  const paul = await prisma.tenant.create({ data: { firstName: 'Paul', lastName: 'Exemple', email: 'paul@example.com', createdById: adminId } })
  const zoe = await prisma.tenant.create({ data: { firstName: 'Zoé', lastName: 'Fictif', email: 'zoe@example.com', createdById: adminId } })
  // Paul : libellé de rapprochement renseigné ; Zoé : aucun, le nom du locataire suffit
  const leaseA = await prisma.lease.create({ data: {
    propertyId: property.id, tenantId: paul.id, type: 'UNFURNISHED', startDate: start,
    rentAmount: 850, chargesAmount: 50, rentDayOfMonth: 1, bankLabel: 'PAUL EXEMPLE', active: true,
  } })
  const leaseB = await prisma.lease.create({ data: {
    propertyId: property.id, tenantId: zoe.id, type: 'FURNISHED', startDate: start,
    rentAmount: 580, chargesAmount: 40, rentDayOfMonth: 5, active: true,
  } })

  const payments: Record<string, string> = {}
  for (const lease of [leaseA, leaseB]) {
    for (const m of months) {
      const due = computeMonthlyDue(lease, m.year, m.month)!
      const p = await prisma.rentPayment.create({ data: { leaseId: lease.id, periodYear: m.year, periodMonth: m.month, ...due } })
      payments[`${lease.id}:${m.month}`] = p.id
    }
  }

  const account = await prisma.bankAccount.create({ data: { userId: adminId, name: ACCOUNT } })
  const [m1, m2, m3] = months
  const ops: [Date, string, number][] = [
    [day(m1, 3), 'VIR SEPA PAUL EXEMPLE LOYER', 900],
    [day(m2, 2), 'VIR SEPA PAUL EXEMPLE LOYER', 900],
    [day(m3, 3), 'VIR SEPA PAUL EXEMPLE LOYER', 900],
    [day(m2, 6), 'VIR M OU MME FICTIF ZOE', 1240],
    [day(m3, 8), 'VIR FICTIF Z', 300],
    [day(m2, 15), 'VIR REMBOURSEMENT ASSURANCE', 45.2],
    [day(m1, 10), 'PRLV ASSURANCE PNO', -12.5],
    [day(m2, 18), 'CB BRICOLAGE LYON', -58.9],
    [day(m3, 15), 'PRLV TAXE FONCIERE', -1024],
  ]
  await prisma.bankTransaction.createMany({
    data: ops.map(([date, label, amount], i) => ({ accountId: account.id, externalId: `demo:${i + 1}`, date, label, amount })),
  })

  // Le premier virement de Paul est déjà rapproché
  const first = await prisma.bankTransaction.findFirstOrThrow({ where: { accountId: account.id, externalId: 'demo:1' } })
  await prisma.$transaction([
    prisma.rentPayment.update({
      where: { id: payments[`${leaseA.id}:${m1.month}`] },
      data: { receivedAmount: 900, paymentDate: first.date, status: 'RECEIVED', source: 'BANK_MATCH', bankTransactionId: first.id },
    }),
    prisma.bankTransaction.update({ where: { id: first.id }, data: { status: 'MATCHED' } }),
  ])
  console.log(`✅ ${NAME} : 2 baux, 6 échéances ; « ${ACCOUNT} » : ${ops.length} opérations (1 rapprochée, 5 encaissements à rapprocher, 3 débits).`)
}

async function remove(adminId: string) {
  const account = await prisma.bankAccount.findFirst({ where: { name: ACCOUNT, userId: adminId } })
  const property = await prisma.property.findFirst({ where: { name: NAME, ownerships: { some: { userId: adminId } } }, include: { leases: true } })
  if (!account && !property) return console.log(`« ${NAME} » n'existe pas : rien à supprimer.`)
  if (property) {
    const leaseIds = property.leases.map((l) => l.id)
    await prisma.receipt.deleteMany({ where: { rentPayment: { leaseId: { in: leaseIds } } } })
    await prisma.rentPayment.deleteMany({ where: { leaseId: { in: leaseIds } } })
    await prisma.notification.deleteMany({ where: { leaseId: { in: leaseIds } } })
    await prisma.lease.deleteMany({ where: { id: { in: leaseIds } } })
    await prisma.tenant.deleteMany({ where: { id: { in: property.leases.map((l) => l.tenantId) }, leases: { none: {} } } })
    await prisma.ownership.deleteMany({ where: { propertyId: property.id } })
    await prisma.property.delete({ where: { id: property.id } })
  }
  if (account) {
    // Les échéances d'autres biens éventuellement rapprochées depuis ce compte repassent en attente
    await prisma.rentPayment.updateMany({
      where: { bankTransaction: { accountId: account.id } },
      data: { bankTransactionId: null, receivedAmount: null, paymentDate: null, status: 'PENDING', source: 'MANUAL' },
    })
    await prisma.bankAccount.delete({ where: { id: account.id } })
  }
  console.log(`🗑️  ${NAME} et « ${ACCOUNT} » supprimés.`)
}

async function main() {
  const admin = await prisma.user.findFirstOrThrow({ where: { role: 'ADMIN' }, orderBy: { createdAt: 'asc' } })
  if (process.argv.includes('--supprimer')) return remove(admin.id)
  if (await prisma.property.findFirst({ where: { name: NAME, ownerships: { some: { userId: admin.id } } } })) {
    console.log(`« ${NAME} » existe déjà : rien à faire (--supprimer pour le retirer, puis relancer).`)
    return
  }
  await create(admin.id)
}

main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
