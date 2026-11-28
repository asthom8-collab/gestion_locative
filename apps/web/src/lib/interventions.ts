import type { InterventionDoneBy, InterventionKind, InterventionNature, InterventionPayer, InterventionStatus, InterventionTax } from '../types'

/** Types de travaux (liste de la maquette). */
export const INTERVENTION_KINDS: Record<InterventionKind, string> = {
  PLUMBING: 'Plomberie',
  ELECTRICITY: 'Électricité',
  HEATING: 'Chauffage',
  PAINTING: 'Peinture',
  CARPENTRY: 'Menuiserie',
  LOCKSMITH: 'Serrurerie',
  CLEANING: 'Nettoyage',
  RENOVATION: 'Remise en état',
  DAMAGE: 'Sinistre',
  GARDENING: 'Jardinage',
  OTHER: 'Autre',
}

export const INTERVENTION_STATUS: Record<InterventionStatus, string> = { PLANNED: 'Prévue', DONE: 'Faite' }
export const DONE_BY: Record<InterventionDoneBy, string> = { OWNER: 'Moi-même', PROFESSIONAL: 'Un professionnel' }
export const PAID_BY: Record<InterventionPayer, string> = { OWNER: 'Le propriétaire', TENANT: 'Le locataire', INSURANCE: 'L’assurance' }

/** Nature fiscale : libellé court et aide affichée sous le choix. */
export const NATURES: Record<InterventionNature, { label: string; hint: string }> = {
  MAINTENANCE: {
    label: 'Entretien ou réparation',
    hint: 'Remettre en état sans changer le bien : fuite, peinture, remplacement à l’identique d’une chaudière… Déductible en location nue ; charge en LMNP au réel.',
  },
  IMPROVEMENT: {
    label: 'Amélioration',
    hint: 'Apporter un confort nouveau sans toucher au gros œuvre : isolation, chauffage central, double vitrage… Déductible en location nue (hors local commercial) ; amortie en LMNP au réel.',
  },
  CONSTRUCTION: {
    label: 'Construction, agrandissement',
    hint: 'Créer de la surface ou toucher au gros œuvre : extension, surélévation, aménagement de combles… Non déductible en location nue ; amortie en LMNP au réel.',
  },
}

/** Couleur du traitement fiscal calculé par l'API. */
export const TAX_STYLE: Record<InterventionTax['code'], string> = {
  DEDUCTIBLE: 'bg-emerald-50 text-emerald-700',
  DEPRECIABLE: 'bg-sky-50 text-sky-700',
  NOT_DEDUCTIBLE: 'bg-rose-50 text-rose-700',
  NONE: 'bg-slate-100 text-slate-500',
}
