import { amountRow, day, eur, Landlord, letterHeader, pdfBuffer, signatureBlock } from './pdfCommon'

type Place = { address: string; zipCode: string; city: string }
const plural = (n: number, one: string, many: string) => (n > 1 ? many : one)
const irlFmt = (v: number) => v.toLocaleString('fr-FR', { minimumFractionDigits: 2 })

function closing(doc: PDFKit.PDFDocument, landlords: Landlord[], issuedAt: Date) {
  const x = doc.page.margins.left
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right
  doc.moveDown(1)
  doc.font('Helvetica').fontSize(11).text(`Fait à ${landlords[0].city}, le ${day(issuedAt)}`, x)
  doc.moveDown(0.8)
  signatureBlock(doc, landlords, x, width)
}

export type RevisionLetterData = {
  landlords: Landlord[]
  tenantName: string
  property: Place
  effectiveDate: Date
  previousRent: number
  newRent: number
  chargesAmount: number
  quarter: number
  previousIrl: { value: number; year: number }
  newIrl: { value: number; year: number }
  issuedAt: Date
}

/** Avis de révision annuelle du loyer (art. 17-1 de la loi n° 89-462 du 6 juillet 1989). */
export function renderRevisionLetterPdf(d: RevisionLetterData) {
  return pdfBuffer('Révision du loyer', (doc) => {
    const x = doc.page.margins.left
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right
    letterHeader(doc, d.landlords, d.tenantName, d.property)
    doc.font('Helvetica-Bold').fontSize(13).text('Objet : révision annuelle du loyer')
    doc.moveDown(1)
    doc.font('Helvetica').fontSize(11).text(
      `Conformément à l'article 17-1 de la loi du 6 juillet 1989 et à la clause de révision de votre bail, ` +
        `le loyer du logement situé ${d.property.address}, ${d.property.zipCode} ${d.property.city} ` +
        `est révisé à compter du ${day(d.effectiveDate)} selon l'indice de référence des loyers (IRL) publié par l'INSEE.`,
      { align: 'justify' })
    doc.moveDown(1)
    amountRow(doc, x, width, `IRL de référence (T${d.quarter} ${d.previousIrl.year})`, irlFmt(d.previousIrl.value))
    amountRow(doc, x, width, `Nouvel IRL (T${d.quarter} ${d.newIrl.year})`, irlFmt(d.newIrl.value))
    amountRow(doc, x, width, 'Loyer actuel hors charges', eur(d.previousRent))
    doc.font('Helvetica').fontSize(9).fillColor('#555555')
      .text(`Calcul : ${eur(d.previousRent)} × ${irlFmt(d.newIrl.value)} / ${irlFmt(d.previousIrl.value)}`, x)
    doc.fillColor('black').fontSize(11).moveDown(0.4)
    amountRow(doc, x, width, 'Nouveau loyer hors charges', eur(d.newRent), true)
    amountRow(doc, x, width, 'Provision pour charges (inchangée)', eur(d.chargesAmount))
    amountRow(doc, x, width, 'Nouveau total mensuel', eur(d.newRent + d.chargesAmount), true)
    doc.moveDown(1)
    doc.font('Helvetica').text(
      `${plural(d.landlords.length, 'Je reste', 'Nous restons')} à votre disposition pour toute question. ` +
        `Veuillez agréer l'expression de ${plural(d.landlords.length, 'mes', 'nos')} salutations distinguées.`, x, undefined, { align: 'justify' })
    closing(doc, d.landlords, d.issuedAt)
  })
}

export type RegularizationData = {
  landlords: Landlord[]
  tenantName: string
  property: Place
  year: number
  occupiedDays: number
  daysInYear: number
  charges: { label: string; quarter?: number | null; amount: number; share: number }[]
  totalCharges: number
  totalReal: number
  totalCharged: number
  balance: number
  issuedAt: Date
}

/** Décompte de régularisation annuelle des charges (art. 23 de la loi du 6 juillet 1989). */
export function renderRegularizationPdf(d: RegularizationData) {
  return pdfBuffer('Régularisation des charges', (doc) => {
    const x = doc.page.margins.left
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right
    letterHeader(doc, d.landlords, d.tenantName, d.property)
    doc.font('Helvetica-Bold').fontSize(13).text(`Objet : régularisation des charges locatives ${d.year}`)
    doc.moveDown(1)
    doc.font('Helvetica').fontSize(11).text(
      `Voici le décompte des charges récupérables de l'année ${d.year} pour le logement situé ` +
        `${d.property.address}, ${d.property.zipCode} ${d.property.city}. ` +
        `Votre quote-part tient compte de votre période d'occupation : ${d.occupiedDays} jours sur ${d.daysInYear}.`,
      { align: 'justify' })
    doc.moveDown(1)
    doc.font('Helvetica-Bold').text('Charges réelles de l’année')
    doc.moveDown(0.3)
    d.charges.forEach((c) => amountRow(doc, x, width, `${c.label}${c.quarter ? ` (T${c.quarter})` : ''} (${eur(c.amount)} au total)`, eur(c.share)))
    doc.moveTo(x, doc.y).lineTo(x + width, doc.y).stroke()
    doc.moveDown(0.4)
    amountRow(doc, x, width, 'Votre part des charges réelles', eur(d.totalReal), true)
    amountRow(doc, x, width, 'Provisions pour charges appelées', `- ${eur(d.totalCharged)}`)
    doc.moveTo(x, doc.y).lineTo(x + width, doc.y).stroke()
    doc.moveDown(0.4)
    const label = d.balance > 0 ? 'Reste à payer par le locataire' : d.balance < 0 ? 'À rembourser au locataire' : 'Solde'
    amountRow(doc, x, width, label, eur(Math.abs(d.balance)), true)
    doc.moveDown(1)
    doc.font('Helvetica').fontSize(10).text(
      'Les justificatifs des charges sont tenus à votre disposition pendant six mois à compter de l’envoi de ce décompte.',
      x, undefined, { align: 'justify' })
    closing(doc, d.landlords, d.issuedAt)
  })
}
