/**
 * Données de démonstration pour les pages Paiements et Documents, dans la base de DATABASE_URL (dev ou test à distance).
 * Crée un bien « Démo paiements » au premier administrateur (locataire fictif Léa Exemple, bail depuis septembre 2025),
 * ses échéances jusqu'au mois en cours : payées, une partielle, deux en retard ; puis des documents d'exemple
 * (PDF et photos générés, marqués « document fictif ») sur ce bien, sur son bail et sur le bien « Démo régularisation »
 * s'il existe. Ne touche à aucune autre donnée ; ne fait rien si le bien existe déjà.
 *   npm run demo:paiements-documents
 *   npm run demo:paiements-documents -- --supprimer    (retire ces données de démonstration)
 */
import { deflateSync } from 'node:zlib'
import { DocumentCategory, PrismaClient } from '@prisma/client'
import { computeMonthlyDue } from '../src/lib/period'
import { pdfBuffer } from '../src/lib/pdfCommon'
import { removeFile } from '../src/lib/storage'
import { documentsService } from '../src/services/documents'

const prisma = new PrismaClient()
const NAME = 'Démo paiements'
const REGUL = 'Démo régularisation'

// ── Fichiers d'exemple ─────────────────────────────────────────────

function fakePdf(title: string, lines: string[]) {
  return pdfBuffer(title, (doc) => {
    doc.fontSize(9).fillColor('#b91c1c').text('EXEMPLE — DOCUMENT FICTIF (données de démonstration)', { align: 'right' })
    doc.moveDown(2).fontSize(20).fillColor('#111827').text(title)
    doc.moveDown().fontSize(11).fillColor('#374151')
    for (const l of lines) doc.text(l).moveDown(0.5)
    doc.moveDown(2).fontSize(9).fillColor('#9ca3af').text(`Généré le ${new Date().toLocaleDateString('fr-FR')} par npm run demo:paiements-documents`)
  })
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf: Buffer) => {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

/** « Photo » PNG : ciel en dégradé, sol, et un rectangle (fenêtre) de la couleur donnée. */
function fakePhoto([r, g, b]: [number, number, number], width = 480, height = 320) {
  const raw = Buffer.alloc((width * 3 + 1) * height)
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1)
    raw[row] = 0
    for (let x = 0; x < width; x++) {
      const i = row + 1 + x * 3
      const inWindow = x > width * 0.35 && x < width * 0.65 && y > height * 0.25 && y < height * 0.6
      const px: [number, number, number] = inWindow ? [r, g, b]
        : y > height * 0.75 ? [150, 120, 90]
        : [235 - y / 4, 240 - y / 5, 250]
      raw[i] = px[0]; raw[i + 1] = px[1]; raw[i + 2] = px[2]
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ])
}

// ── Création ───────────────────────────────────────────────────────

async function create(adminId: string) {
  const property = await prisma.property.create({ data: {
    name: NAME, address: '2 rue de l’Exemple', zipCode: '69003', city: 'Lyon', type: 'APARTMENT', surface: 42, fiscalRegime: 'NU', irlQuarter: 3,
    ownerships: { create: { userId: adminId, share: 1 } },
  } })
  const tenant = await prisma.tenant.create({ data: { firstName: 'Léa', lastName: 'Exemple', email: 'lea@example.com', createdById: adminId } })
  const lease = await prisma.lease.create({ data: {
    propertyId: property.id, tenantId: tenant.id, type: 'UNFURNISHED', startDate: new Date('2025-09-01'),
    rentAmount: 750, chargesAmount: 50, rentDayOfMonth: 5, active: true,
  } })

  // Échéances de septembre 2025 au mois en cours : l'avant-avant-dernière payée en partie, les deux dernières en retard
  const now = new Date()
  const months: { year: number; month: number }[] = []
  for (let d = new Date(Date.UTC(2025, 8, 1)); d <= now; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)))
    months.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 })
  const rows = months.map(({ year, month }, i) => {
    const left = months.length - 1 - i
    const due = computeMonthlyDue(lease, year, month)!
    const status = left >= 3 ? 'RECEIVED' : left === 2 ? 'PARTIAL' : 'PENDING'
    const receivedAmount = status === 'RECEIVED' ? due.expectedAmount : status === 'PARTIAL' ? 500 : null
    return {
      leaseId: lease.id, periodYear: year, periodMonth: month, ...due, status, receivedAmount,
      paymentDate: receivedAmount === null ? null : new Date(Date.UTC(year, month - 1, 4 + (i % 4))),
    } as const
  })
  await prisma.rentPayment.createMany({ data: rows })
  const count = (st: string) => rows.filter((r) => r.status === st).length

  const docs: { target: { leaseId: string } | { propertyId: string }; category: DocumentCategory; label: string; file: () => Promise<Buffer> | Buffer; type: string }[] = [
    { target: { leaseId: lease.id }, category: 'LEASE_CONTRACT', label: 'Bail signé — Léa Exemple', type: 'application/pdf',
      file: () => fakePdf('Contrat de location (logement vide)', [`Bailleur : propriétaire du bien « ${NAME} »`, 'Locataire : Léa Exemple', 'Prise d’effet : 1er septembre 2025, durée 3 ans', 'Loyer : 750 € + 50 € de provisions sur charges, payable le 5 du mois']) },
    { target: { leaseId: lease.id }, category: 'INVENTORY_ENTRY', label: 'État des lieux d’entrée', type: 'application/pdf',
      file: () => fakePdf('État des lieux d’entrée', ['Date : 1er septembre 2025', 'Séjour : bon état, peinture récente', 'Cuisine : plaques et hotte en état de marche', 'Salle d’eau : joints à reprendre (signalé)', 'Compteur d’eau : 01234 m³ ; électricité : 45678 kWh']) },
    { target: { leaseId: lease.id }, category: 'INSURANCE', label: 'Attestation d’assurance habitation 2026', type: 'application/pdf',
      file: () => fakePdf('Attestation d’assurance habitation', ['Assurée : Léa Exemple', `Logement : ${NAME}, 2 rue de l’Exemple, 69003 Lyon`, 'Période : du 1er septembre 2026 au 31 août 2027', 'Garanties : responsabilité civile, dégâts des eaux, incendie']) },
    { target: { leaseId: lease.id }, category: 'PHOTO', label: 'Photo du séjour (entrée)', type: 'image/png', file: () => fakePhoto([70, 110, 180]) },
    { target: { leaseId: lease.id }, category: 'PHOTO', label: 'Photo de la cuisine (entrée)', type: 'image/png', file: () => fakePhoto([200, 150, 60]) },
    { target: { propertyId: property.id }, category: 'DIAGNOSTIC', label: 'DPE — classe D', type: 'application/pdf',
      file: () => fakePdf('Diagnostic de performance énergétique', ['Classe énergie : D (210 kWh/m²/an)', 'Classe climat : C', 'Valable jusqu’en 2034', 'Recommandations : isolation des combles, fenêtres double vitrage']) },
    { target: { propertyId: property.id }, category: 'PROPERTY_TAX', label: 'Taxe foncière 2026', type: 'application/pdf',
      file: () => fakePdf('Avis de taxe foncière 2026', [`Bien : ${NAME}`, 'Montant : 1 024 €, dont taxe d’enlèvement des ordures ménagères : 168 €', 'Date limite de paiement : 15 octobre 2026']) },
    { target: { propertyId: property.id }, category: 'INVOICE', label: 'Facture plombier — fuite salle d’eau', type: 'application/pdf',
      file: () => fakePdf('Facture n° 2026-042', ['Intervention du 12 mars 2026 : recherche de fuite et remplacement du joint de la douche', 'Main-d’œuvre : 120 € HT ; fournitures : 35 € HT', 'Total TTC : 170,50 €']) },
  ]
  const regul = await prisma.property.findFirst({ where: { name: REGUL, ownerships: { some: { userId: adminId } } } })
  if (regul) {
    docs.push(
      { target: { propertyId: regul.id }, category: 'TITLE_DEED', label: 'Titre de propriété', type: 'application/pdf',
        file: () => fakePdf('Attestation de propriété', [`Bien : ${REGUL}, 1 rue de l’Exemple, 69001 Lyon`, 'Acquisition : 2019', 'Acte reçu par l’office notarial (exemple)']) },
      { target: { propertyId: regul.id }, category: 'INVOICE', label: 'Facture eau 2025 (rectifiée)', type: 'image/png', file: () => fakePhoto([40, 160, 200]) },
    )
  }
  for (const d of docs) {
    await documentsService.upload({ userId: adminId, ...d.target, category: d.category, label: d.label,
      fileName: `${d.label}.${d.type === 'image/png' ? 'png' : 'pdf'}`, mimeType: d.type, content: await d.file() })
  }
  console.log(`✅ ${NAME} : ${count('RECEIVED')} échéances payées, ${count('PARTIAL')} partielle, ${count('PENDING')} en retard ; ${docs.length} documents d'exemple${regul ? ` (dont 2 sur « ${REGUL} »)` : ''}.`)
}

// ── Suppression ────────────────────────────────────────────────────

async function remove(adminId: string) {
  const property = await prisma.property.findFirst({ where: { name: NAME, ownerships: { some: { userId: adminId } } }, include: { leases: true } })
  if (!property) return console.log(`« ${NAME} » n'existe pas : rien à supprimer.`)
  const leaseIds = property.leases.map((l) => l.id)
  const regul = await prisma.property.findFirst({ where: { name: REGUL, ownerships: { some: { userId: adminId } } } })
  // Documents du bien, de son bail, et ceux d'exemple ajoutés sur « Démo régularisation »
  const docs = await prisma.document.findMany({ where: { OR: [
    { propertyId: property.id }, { leaseId: { in: leaseIds } },
    ...(regul ? [{ propertyId: regul.id, label: { in: ['Titre de propriété', 'Facture eau 2025 (rectifiée)'] } }] : []),
  ] } })
  await prisma.document.deleteMany({ where: { id: { in: docs.map((d) => d.id) } } })
  await Promise.all(docs.map((d) => removeFile(d.filePath)))
  const receipts = await prisma.receipt.findMany({ where: { rentPayment: { leaseId: { in: leaseIds } } } })
  await prisma.receipt.deleteMany({ where: { id: { in: receipts.map((r) => r.id) } } })
  await Promise.all(receipts.map((r) => removeFile(r.filePath)))
  await prisma.rentPayment.deleteMany({ where: { leaseId: { in: leaseIds } } })
  await prisma.notification.deleteMany({ where: { leaseId: { in: leaseIds } } })
  await prisma.lease.deleteMany({ where: { id: { in: leaseIds } } })
  await prisma.tenant.deleteMany({ where: { id: { in: property.leases.map((l) => l.tenantId) }, leases: { none: {} } } })
  await prisma.ownership.deleteMany({ where: { propertyId: property.id } })
  await prisma.property.delete({ where: { id: property.id } })
  console.log(`🗑️  ${NAME} supprimé, avec ${docs.length} documents d'exemple.`)
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
