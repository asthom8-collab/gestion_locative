import PDFDocument from 'pdfkit'

export type Landlord = { name: string; address: string; zipCode: string; city: string; signature?: Buffer }

// Les polices standard du PDF (WinAnsi) n'ont pas les espaces fines insécables de Intl
const clean = (s: string) => s.replace(/[  ]/g, ' ')
export const eur = (n: number) =>
  clean(new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n))
export const day = (d: Date) => clean(d.toLocaleDateString('fr-FR', { timeZone: 'UTC' }))
export const monthLabel = (d: Date) =>
  d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })

/** Document A4 rendu en mémoire. */
export function pdfBuffer(title: string, draw: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolvePdf, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56, info: { Title: title } })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolvePdf(Buffer.concat(chunks)))
    doc.on('error', reject)
    draw(doc)
    doc.end()
  })
}

/** Une colonne par bailleur (trois par ligne au plus) : nom, puis signature ou espace pour signer. */
export function signatureBlock(doc: PDFKit.PDFDocument, landlords: Landlord[], x: number, width: number) {
  const perRow = Math.min(3, landlords.length)
  const colWidth = width / perRow
  const sigHeight = 55
  for (let i = 0; i < landlords.length; i += perRow) {
    const top = doc.y
    landlords.slice(i, i + perRow).forEach((l, j) => {
      const cx = x + j * colWidth
      doc.font('Helvetica').fontSize(10).text(l.name, cx, top, { width: colWidth - 10 })
      if (l.signature) {
        try {
          doc.image(l.signature, cx, top + 16, { fit: [Math.min(170, colWidth - 10), sigHeight] })
        } catch {
          // Image illisible : on laisse l'espace vide pour une signature manuscrite
        }
      }
    })
    doc.y = top + 16 + sigHeight + 10
  }
  doc.x = x
}

/** Ligne libellé / montant aligné à droite. */
export function amountRow(doc: PDFKit.PDFDocument, x: number, width: number, label: string, value: string, bold = false) {
  const y = doc.y
  doc.font(bold ? 'Helvetica-Bold' : 'Helvetica')
  doc.text(label, x, y, { width: width - 120 })
  doc.text(value, x + width - 120, y, { width: 120, align: 'right' })
  doc.moveDown(0.4)
}

/** En-tête commun aux courriers : bailleurs à gauche, locataire et logement en dessous. */
export function letterHeader(doc: PDFKit.PDFDocument, landlords: Landlord[], tenant: string, property: { address: string; zipCode: string; city: string }) {
  doc.font('Helvetica').fontSize(10)
  landlords.forEach((l) => { doc.text(l.name); doc.text(l.address); doc.text(`${l.zipCode} ${l.city}`); doc.moveDown(0.3) })
  doc.moveDown(0.5)
  doc.text(tenant, { align: 'right' })
  doc.text(property.address, { align: 'right' })
  doc.text(`${property.zipCode} ${property.city}`, { align: 'right' })
  doc.moveDown(1.5)
}
