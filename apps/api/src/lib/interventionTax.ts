import { FiscalRegime, PropertyType, InterventionDoneBy, InterventionNature, InterventionPayer, InterventionStatus } from '@prisma/client'

/**
 * Traitement fiscal d'une intervention, selon le régime du bien et la nature des travaux.
 * - Location nue et Pinel (revenus fonciers, réel) : entretien, réparation et amélioration déductibles ;
 *   construction, reconstruction et agrandissement non déductibles (CGI art. 31, BOI-RFPI-BASE-20-30).
 *   Local commercial ou professionnel : l'amélioration n'est pas déductible (CGI art. 31 I-1° b bis), sauf travaux
 *   contre l'amiante ou pour l'accueil des personnes handicapées (exception non gérée : à corriger à la main).
 * - LMNP au réel : entretien et réparation en charges ; amélioration et construction immobilisées puis amorties.
 * - Micro-foncier et micro-BIC : abattement forfaitaire, aucune dépense déduite (le régime « NU » est traité comme
 *   le réel tant que le choix micro / réel n'est pas saisi par bien, voir PLAN-SUITE.md).
 * - Travaux faits soi-même : seuls les matériaux comptent, sur facture ; la main-d'œuvre du propriétaire jamais
 *   (BOI-RFPI-BASE-20-30-30). Le coût saisi est alors celui des matériaux.
 * - Prévue, ou payée par le locataire ou l'assurance : rien à déclarer pour le propriétaire.
 */
export type TaxCode = 'DEDUCTIBLE' | 'NOT_DEDUCTIBLE' | 'DEPRECIABLE' | 'NONE'
export type TaxTreatment = { code: TaxCode; label: string; amount: number }

type Input = {
  status: InterventionStatus
  paidBy: InterventionPayer
  doneBy: InterventionDoneBy
  fiscalNature: InterventionNature
  cost: number
}

export function taxTreatment(i: Input, regime: FiscalRegime, propertyType?: PropertyType): TaxTreatment {
  const none = (label: string): TaxTreatment => ({ code: 'NONE', label, amount: 0 })
  if (i.status === 'PLANNED') return none('Prévue : comptera une fois faite')
  if (i.paidBy === 'TENANT') return none('Payée par le locataire : rien à déclarer')
  if (i.paidBy === 'INSURANCE') return none('Prise en charge par l’assurance : rien à déclarer')
  const materials = i.doneBy === 'OWNER' ? ' (matériaux sur facture, sans votre main-d’œuvre)' : ''
  if (regime === 'LMNP_MICRO') return none('Micro-BIC : abattement forfaitaire, pas de déduction')
  if (regime === 'LMNP_REEL') {
    if (i.fiscalNature === 'MAINTENANCE') return { code: 'DEDUCTIBLE', label: `Charge déductible${materials}`, amount: i.cost }
    return { code: 'DEPRECIABLE', label: `À immobiliser et amortir${materials}`, amount: i.cost }
  }
  if (i.fiscalNature === 'CONSTRUCTION') return { code: 'NOT_DEDUCTIBLE', label: 'Non déductible (construction, agrandissement)', amount: 0 }
  if (i.fiscalNature === 'IMPROVEMENT' && propertyType === 'COMMERCIAL') {
    return { code: 'NOT_DEDUCTIBLE', label: 'Non déductible (amélioration d’un local commercial)', amount: 0 }
  }
  return { code: 'DEDUCTIBLE', label: `Déductible des revenus fonciers${materials}`, amount: i.cost }
}
