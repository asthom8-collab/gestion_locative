/**
 * Données de démonstration de la page Interventions, dans la base de DATABASE_URL (dev ou test à distance).
 * Crée au premier administrateur un bien meublé « Démo interventions LMNP » (LMNP au réel, sans bail), avec des
 * travaux à charger ou à amortir ; ajoute aussi des interventions sur « Démo paiements » (pendant le bail de Léa
 * Exemple) et « Démo régularisation » s'ils existent (lancer npm run demo dans l'ordre). Couvre les cas : professionnel
 * avec facture et devis, travaux faits soi-même (matériaux), payée par le locataire ou l'assurance, prévue,
 * construction non déductible. Ne touche à aucune autre donnée ; ne fait rien si le bien existe déjà.
 *   npm run demo:interventions
 *   npm run demo:interventions -- --supprimer    (retire ces données de démonstration)
 */
import { InterventionDoneBy, InterventionKind, InterventionNature, InterventionPayer, InterventionStatus, PrismaClient } from '@prisma/client'
import { pdfBuffer } from '../src/lib/pdfCommon'
import { removeFile } from '../src/lib/storage'
import { documentsService } from '../src/services/documents'

const prisma = new PrismaClient()
const NAME = 'Démo interventions LMNP'
const OTHERS = ['Démo paiements', 'Démo régularisation']
// Repère des interventions d'exemple sur les autres biens de démo (pour les retirer sans toucher au reste)
const MARK = 'Exemple (données de démonstration).'

function fakeInvoice(title: string, lines: string[]) {
  return pdfBuffer(title, (doc) => {
    doc.fontSize(9).fillColor('#b91c1c').text('EXEMPLE — DOCUMENT FICTIF (données de démonstration)', { align: 'right' })
    doc.moveDown(2).fontSize(20).fillColor('#111827').text(title)
    doc.moveDown().fontSize(11).fillColor('#374151')
    for (const l of lines) doc.text(l).moveDown(0.5)
  })
}

type Demo = {
  title: string; kind: InterventionKind; date: string; cost: number
  status?: InterventionStatus; doneBy?: InterventionDoneBy; providerName?: string; paidBy?: InterventionPayer
  fiscalNature?: InterventionNature; notes?: string; withLease?: boolean
  docs?: { category: 'INVOICE' | 'QUOTE'; label: string; lines: string[] }[]
}

const year = new Date().getFullYear()

const LMNP: Demo[] = [
  { title: 'Remplacement du lave-linge', kind: 'OTHER', date: `${year}-02-10`, cost: 429, providerName: 'Électroménager Exemple',
    fiscalNature: 'IMPROVEMENT', notes: 'Équipement du meublé : immobilisé et amorti sur 5 à 10 ans.',
    docs: [{ category: 'INVOICE', label: 'Facture lave-linge', lines: ['Lave-linge 8 kg, livraison et installation', 'Total TTC : 429,00 €'] }] },
  { title: 'Réparation de la serrure', kind: 'LOCKSMITH', date: `${year}-04-03`, cost: 145, providerName: 'Serrurerie Exemple',
    docs: [{ category: 'INVOICE', label: 'Facture serrurier', lines: ['Changement du cylindre de la porte d’entrée', 'Total TTC : 145,00 €'] }] },
  { title: 'Rénovation de la salle d’eau', kind: 'RENOVATION', date: `${year}-09-15`, cost: 6800, providerName: 'Rénov Exemple',
    fiscalNature: 'IMPROVEMENT', notes: 'Douche à l’italienne, faïence, meuble vasque.',
    docs: [
      { category: 'QUOTE', label: 'Devis rénovation salle d’eau', lines: ['Dépose, plomberie, carrelage, meuble vasque', 'Total TTC : 6 800,00 €', 'Devis accepté le 1er juillet'] },
      { category: 'INVOICE', label: 'Facture rénovation salle d’eau', lines: ['Travaux réalisés du 8 au 15 septembre', 'Total TTC : 6 800,00 €'] },
    ] },
  { title: 'Peinture du séjour', kind: 'PAINTING', date: `${year + 1}-03-01`, cost: 900, status: 'PLANNED', providerName: 'Peinture Exemple' },
]

const PAIEMENTS: Demo[] = [
  { title: 'Fuite sous l’évier', kind: 'PLUMBING', date: `${year}-03-12`, cost: 170.5, providerName: 'Plomberie Exemple', withLease: true,
    docs: [{ category: 'INVOICE', label: 'Facture plombier — évier', lines: ['Remplacement du siphon et des joints', 'Total TTC : 170,50 €'] }] },
  { title: 'Peinture de la chambre', kind: 'PAINTING', date: `${year - 1}-08-20`, cost: 86.4, doneBy: 'OWNER',
    notes: 'Faite moi-même avant l’entrée de la locataire : seuls la peinture et les rouleaux comptent.',
    docs: [{ category: 'INVOICE', label: 'Ticket magasin de bricolage', lines: ['Peinture blanche mate 10 L, rouleaux, bâche', 'Total TTC : 86,40 €'] }] },
  { title: 'Ampoules et joint de douche', kind: 'ELECTRICITY', date: `${year}-06-05`, cost: 32, paidBy: 'TENANT', withLease: true,
    notes: 'Menu entretien à la charge de la locataire (décret 87-712).' },
  { title: 'Dégât des eaux (voisin du dessus)', kind: 'DAMAGE', date: `${year}-01-22`, cost: 1250, paidBy: 'INSURANCE',
    providerName: 'Plâtrerie Exemple', withLease: true, notes: 'Reprise du plafond de la salle d’eau, payée par l’assurance de l’immeuble.' },
]

const REGUL: Demo[] = [
  { title: 'Création d’une mezzanine', kind: 'CARPENTRY', date: `${year - 1}-11-10`, cost: 4200, providerName: 'Menuiserie Exemple',
    fiscalNature: 'CONSTRUCTION', notes: 'Crée de la surface habitable : non déductible en location nue.' },
  { title: 'Remplacement du chauffe-eau', kind: 'HEATING', date: `${year}-10-02`, cost: 980, providerName: 'Chauffage Exemple',
    docs: [{ category: 'INVOICE', label: 'Facture chauffe-eau', lines: ['Chauffe-eau électrique 150 L, pose et mise en service', 'Total TTC : 980,00 €'] }] },
]

async function add(adminId: string, propertyId: string, leaseId: string | null, items: Demo[], marked: boolean) {
  for (const { docs = [], withLease, notes, ...d } of items) {
    const i = await prisma.intervention.create({ data: {
      ...d, propertyId, leaseId: withLease ? leaseId : null, date: new Date(`${d.date}T00:00:00.000Z`),
      notes: marked ? [notes, MARK].filter(Boolean).join(' ') : notes ?? null,
    } })
    for (const doc of docs) {
      await documentsService.upload({ userId: adminId, interventionId: i.id, category: doc.category, label: doc.label,
        fileName: `${doc.label}.pdf`, mimeType: 'application/pdf', content: await fakeInvoice(doc.label, doc.lines) })
    }
  }
  return items.length
}

async function create(adminId: string) {
  const lmnp = await prisma.property.create({ data: {
    name: NAME, address: '4 rue de l’Exemple', zipCode: '69006', city: 'Lyon', type: 'APARTMENT', surface: 28, fiscalRegime: 'LMNP_REEL', irlQuarter: 4,
    ownerships: { create: { userId: adminId, share: 1 } },
  } })
  let n = await add(adminId, lmnp.id, null, LMNP, false)
  const found: string[] = []
  for (const [name, items] of [[OTHERS[0], PAIEMENTS], [OTHERS[1], REGUL]] as const) {
    const p = await prisma.property.findFirst({ where: { name, ownerships: { some: { userId: adminId } } }, include: { leases: { orderBy: { startDate: 'desc' } } } })
    if (!p) continue
    n += await add(adminId, p.id, p.leases[0]?.id ?? null, items, true)
    found.push(name)
  }
  console.log(`✅ ${NAME} créé ; ${n} interventions d'exemple${found.length ? ` (dont sur ${found.map((f) => `« ${f} »`).join(' et ')})` : ''}.`)
}

async function remove(adminId: string) {
  const owned = { ownerships: { some: { userId: adminId } } }
  const interventions = await prisma.intervention.findMany({ where: { OR: [
    { property: { name: NAME, ...owned } },
    { property: { name: { in: OTHERS }, ...owned }, notes: { contains: MARK } },
  ] }, select: { id: true } })
  const ids = interventions.map((i) => i.id)
  const lmnp = await prisma.property.findFirst({ where: { name: NAME, ...owned } })
  const docs = await prisma.document.findMany({ where: { OR: [{ interventionId: { in: ids } }, ...(lmnp ? [{ propertyId: lmnp.id }] : [])] } })
  await prisma.document.deleteMany({ where: { id: { in: docs.map((d) => d.id) } } })
  await Promise.all(docs.map((d) => removeFile(d.filePath)))
  await prisma.intervention.deleteMany({ where: { id: { in: ids } } })
  if (lmnp) {
    await prisma.ownership.deleteMany({ where: { propertyId: lmnp.id } })
    await prisma.property.delete({ where: { id: lmnp.id } })
  }
  console.log(`🗑️  ${ids.length} interventions d'exemple et ${docs.length} documents supprimés${lmnp ? `, ainsi que « ${NAME} »` : ''}.`)
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
