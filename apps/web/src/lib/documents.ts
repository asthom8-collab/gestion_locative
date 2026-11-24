import type { DocumentCategory, DocumentItem } from '../types'
import { fullName } from './format'

export const DOCUMENT_CATEGORIES: Record<DocumentCategory, string> = {
  LEASE_CONTRACT: 'Contrat de bail',
  INVENTORY_ENTRY: "État des lieux d'entrée",
  INVENTORY_EXIT: 'État des lieux de sortie',
  INSURANCE: "Attestation d'assurance",
  PHOTO: 'Photos',
  DIAGNOSTIC: 'Diagnostics (DPE, électricité…)',
  TITLE_DEED: 'Titre de propriété',
  PROPERTY_TAX: 'Taxe foncière',
  INVOICE: 'Facture (travaux, entretien)',
  OTHER: 'Autre',
}

/** Types proposés en premier selon le rattachement (tous restent possibles). */
export const LEASE_CATEGORIES: DocumentCategory[] = ['LEASE_CONTRACT', 'INVENTORY_ENTRY', 'INVENTORY_EXIT', 'INSURANCE', 'PHOTO', 'OTHER']
export const PROPERTY_CATEGORIES: DocumentCategory[] = ['DIAGNOSTIC', 'TITLE_DEED', 'PROPERTY_TAX', 'INVOICE', 'PHOTO', 'OTHER']

/** Types acceptés par l'API (champ accept du sélecteur de fichier). */
export const ACCEPTED_FILES = '.pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx,.odt,.ods'
export const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024

export const fmtSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} Ko` : `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`

/** « Bail de Jean Dupont · T3 Lyon » ou « Bien : T3 Lyon ». */
export function attachmentLabel(d: DocumentItem) {
  if (d.lease) return `Bail de ${fullName(d.lease.tenant)} · ${d.lease.property.name}`
  return `Bien : ${d.property?.name ?? '—'}`
}

