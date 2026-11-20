import PDFDocument from 'pdfkit'

export type ReceiptData = {
  landlords: { name: string; address: string; zipCode: string; city: string }[]
  tenantName: string
  propertyAddress: string
  propertyZipCode: string
  propertyCity: string
  periodStart: Date
  periodEnd: Date
  rentAmount: number
  chargesAmount: number
  totalAmount: number
  paymentDate: Date
  issuedAt: Date
}

// Les polices standard du PDF (WinAnsi) n'ont pas les espaces fines insécables de Intl
const clean = (s: string) => s.replace(/[  ]/g, ' ')
const eur = (n: number) =>
  clean(new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n))
const day = (d: Date) => clean(d.toLocaleDateString('fr-FR', { timeZone: 'UTC' }))
const monthLabel = (d: Date) =>
  d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })

/** Quittance de loyer (art. 21 de la loi n° 89-462 du 6 juillet 1989). */
export function renderReceiptPdf(data: ReceiptData): Promise<Buffer> {
  return new Promise((resolvePdf, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56, info: { Title: 'Quittance de loyer' } })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolvePdf(Buffer.concat(chunks)))
    doc.on('error', reject)

    const landlordNames = data.landlords.map((l) => l.name).join(' et ')
    const first = data.landlords[0]

    doc.font('Helvetica-Bold').fontSize(20).text('Quittance de loyer', { align: 'center' })
    doc.moveDown(0.3)
    doc.font('Helvetica').fontSize(12)
      .text(`Période : ${monthLabel(data.periodStart)} (du ${day(data.periodStart)} au ${day(data.periodEnd)})`, { align: 'center' })
    doc.moveDown(1.5)

    const block = (title: string, lines: string[]) => {
      doc.font('Helvetica-Bold').fontSize(11).text(title)
      doc.font('Helvetica').fontSize(11)
      lines.forEach((l) => doc.text(l))
      doc.moveDown(0.8)
    }
    block(data.landlords.length > 1 ? 'Bailleurs' : 'Bailleur', data.landlords.flatMap((l) => [l.name, l.address, `${l.zipCode} ${l.city}`]))
    block('Locataire', [data.tenantName])
    block('Adresse du logement', [data.propertyAddress, `${data.propertyZipCode} ${data.propertyCity}`])
    doc.moveDown(0.5)

    doc.text(
      `${data.landlords.length > 1 ? 'Nous soussignés' : 'Je soussigné(e)'} ${landlordNames}, ` +
        `${data.landlords.length > 1 ? 'bailleurs' : 'bailleur'} du logement désigné ci-dessus, ` +
        `${data.landlords.length > 1 ? 'déclarons' : 'déclare'} avoir reçu de ${data.tenantName} ` +
        `la somme de ${eur(data.totalAmount)} au titre du paiement du loyer et des charges ` +
        `pour la période du ${day(data.periodStart)} au ${day(data.periodEnd)}, ` +
        `et ${data.landlords.length > 1 ? 'lui en donnons' : 'lui en donne'} quittance, sous réserve de tous ${data.landlords.length > 1 ? 'nos' : 'mes'} droits.`,
      { align: 'justify' }
    )
    doc.moveDown(1.2)

    // Détail du règlement
    const x = doc.page.margins.left
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right
    const row = (label: string, value: string, bold = false) => {
      const y = doc.y
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica')
      doc.text(label, x, y, { width: width - 120 })
      doc.text(value, x + width - 120, y, { width: 120, align: 'right' })
      doc.moveDown(0.4)
    }
    row('Loyer hors charges', eur(data.rentAmount))
    row('Provision pour charges', eur(data.chargesAmount))
    doc.moveTo(x, doc.y).lineTo(x + width, doc.y).stroke()
    doc.moveDown(0.4)
    row('Total reçu', eur(data.totalAmount), true)
    doc.font('Helvetica').text(`Date du paiement : ${day(data.paymentDate)}`, x)
    doc.moveDown(2)

    doc.text(`Fait à ${first.city}, le ${day(data.issuedAt)}`, x)
    doc.moveDown(0.3)
    doc.text(landlordNames, x)
    doc.moveDown(3)

    doc.fontSize(8).fillColor('#555555').text(
      'Cette quittance annule tous les reçus qui auraient pu être établis précédemment en cas de paiement ' +
        'partiel du montant du présent terme. Elle est à conserver pendant trois ans par le locataire ' +
        '(loi n° 89-462 du 6 juillet 1989, art. 7-1).',
      x,
      undefined,
      { align: 'justify' }
    )
    doc.end()
  })
}
