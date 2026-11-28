import { Link } from 'react-router-dom'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { ChevronRight } from '../components/icons'
import { NATURES, TAX_STYLE } from '../lib/interventions'
import type { InterventionNature, InterventionTax } from '../types'

/** Date de la dernière relecture des règles par rapport aux sources officielles. */
export const RULES_CHECKED_ON = '28 novembre 2026'

type Cell = { code: InterventionTax['code']; text: string }
const ok = (text: string): Cell => ({ code: 'DEDUCTIBLE', text })
const no = (text: string): Cell => ({ code: 'NOT_DEDUCTIBLE', text })
const amort = (text: string): Cell => ({ code: 'DEPRECIABLE', text })
const none = (text: string): Cell => ({ code: 'NONE', text })

/** Traitement selon le régime du bien et la nature des travaux (même logique que l'API, lib/interventionTax.ts). */
const MATRIX: { regime: string; detail: string; cells: Record<InterventionNature, Cell> }[] = [
  { regime: 'Location nue, Pinel (au réel)', detail: 'Revenus fonciers, déclaration 2044', cells: {
    MAINTENANCE: ok('Déductible'), IMPROVEMENT: ok('Déductible'), CONSTRUCTION: no('Non déductible') } },
  { regime: 'Location nue : local commercial', detail: 'Revenus fonciers', cells: {
    MAINTENANCE: ok('Déductible'), IMPROVEMENT: no('Non déductible*'), CONSTRUCTION: no('Non déductible') } },
  { regime: 'LMNP au réel', detail: 'BIC, liasse 2031 / 2033', cells: {
    MAINTENANCE: ok('En charges'), IMPROVEMENT: amort('À amortir'), CONSTRUCTION: amort('À amortir') } },
  { regime: 'Micro-foncier, micro-BIC', detail: 'Abattement forfaitaire', cells: {
    MAINTENANCE: none('Rien à déduire'), IMPROVEMENT: none('Rien à déduire'), CONSTRUCTION: none('Rien à déduire') } },
]

const ORDER: InterventionNature[] = ['MAINTENANCE', 'IMPROVEMENT', 'CONSTRUCTION']

const SPECIAL = [
  { title: 'Intervention prévue', text: 'Elle ne compte qu’une fois faite, l’année de son paiement.' },
  { title: 'Payée par le locataire', text: 'Rien à déclarer pour le propriétaire (menu entretien et réparations locatives, décret n° 87-712).' },
  { title: 'Payée par l’assurance', text: 'Rien à déclarer si l’assurance rembourse tout. Au réel, la règle exacte est : dépense déduite et indemnité déclarée en recette, ce qui revient au même.' },
  { title: 'Faite soi-même', text: 'Seuls les matériaux achetés comptent, sur facture. La main-d’œuvre du propriétaire n’est jamais déductible : le coût saisi est celui des matériaux.' },
]

/** Simplifications de l'application à reprendre (étape Impôts). */
const LIMITS = [
  'Les biens « Location nue » sont traités comme au réel : le choix micro-foncier / réel n’est pas encore saisi par bien.',
  '* Local commercial : les améliorations contre l’amiante ou pour l’accueil des personnes handicapées restent déductibles ; cette exception n’est pas gérée.',
  'LMNP au réel : un petit équipement (moins de 600 € HT) peut en général passer directement en charges ; l’application le classe à amortir.',
  'Remboursement partiel par l’assurance : non géré (choisir « payée par le propriétaire » et noter l’indemnité).',
  'Parking loué seul : traité comme un logement (amélioration déductible), à vérifier.',
  'Montants saisis TTC : juste pour un bailleur qui ne récupère pas la TVA.',
]

const SOURCES = [
  { label: 'BOFiP, BOI-RFPI-BASE-20-30-30 : travaux réalisés par le propriétaire lui-même', href: 'https://bofip.impots.gouv.fr/doctrine/BOI-RFPI-BASE-20-30-30' },
  { label: 'Code général des impôts, article 31 : charges déductibles des revenus fonciers (dont I-1° b et b bis)' },
  { label: 'Décret n° 87-712 du 26 août 1987 : réparations locatives à la charge du locataire' },
]

/** Référentiel : comment l'application classe les travaux et décide de leur traitement aux impôts. */
export function TaxRules() {
  return (
    <div>
      <PageHeader title="Règles fiscales des travaux" subtitle="Comment l’application classe les interventions et calcule ce qui compte aux impôts" />

      <Card className="p-5 mb-4">
        <h3 className="font-semibold tracking-tight mb-1">1. Le type ne décide rien, la nature fiscale décide tout</h3>
        <p className="text-sm text-slate-600 mb-3">
          Le type (plomberie, peinture…) sert à classer et filtrer. Un même type peut relever des trois natures : réparer la chaudière
          (entretien), installer un chauffage central (amélioration), chauffer une extension (agrandissement). La nature se choisit
          donc à chaque intervention ; « Entretien ou réparation » est proposée par défaut.
        </p>
        <dl className="divide-y divide-slate-100">
          {ORDER.map(n => (
            <div key={n} className="py-2.5 sm:grid sm:grid-cols-[14rem_1fr] sm:gap-4">
              <dt className="text-sm font-medium text-slate-900">{NATURES[n].label}</dt>
              <dd className="text-sm text-slate-600">{NATURES[n].hint}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card className="p-5 mb-4">
        <h3 className="font-semibold tracking-tight mb-3">2. Traitement selon le régime du bien</h3>
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-sm min-w-[36rem]">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="font-medium pb-2 pr-3">Régime</th>
                {ORDER.map(n => <th key={n} className="font-medium pb-2 px-2">{NATURES[n].label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {MATRIX.map(row => (
                <tr key={row.regime}>
                  <td className="py-2.5 pr-3"><div className="font-medium text-slate-900">{row.regime}</div><div className="text-xs text-slate-400">{row.detail}</div></td>
                  {ORDER.map(n => (
                    <td key={n} className="py-2.5 px-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${TAX_STYLE[row.cells[n].code]}`}>{row.cells[n].text}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-5 mb-4">
        <h3 className="font-semibold tracking-tight mb-1">3. Cas particuliers, appliqués avant le régime</h3>
        <dl className="divide-y divide-slate-100">
          {SPECIAL.map(s => (
            <div key={s.title} className="py-2.5 sm:grid sm:grid-cols-[14rem_1fr] sm:gap-4">
              <dt className="text-sm font-medium text-slate-900">{s.title}</dt>
              <dd className="text-sm text-slate-600">{s.text}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card className="p-5 mb-4">
        <h3 className="font-semibold tracking-tight mb-2">4. Simplifications à reprendre</h3>
        <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-600">{LIMITS.map(l => <li key={l}>{l}</li>)}</ul>
      </Card>

      <Card className="p-5 mb-4">
        <h3 className="font-semibold tracking-tight mb-2">Sources</h3>
        <ul className="space-y-1.5 text-sm">
          {SOURCES.map(s => <li key={s.label}>{s.href
            ? <a href={s.href} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">{s.label}</a>
            : <span className="text-slate-600">{s.label}</span>}</li>)}
        </ul>
        <p className="text-xs text-slate-400 mt-3">Règles relues le {RULES_CHECKED_ON}. Aide à la déclaration, pas un conseil fiscal : en cas de doute, la notice de l’année ou les impôts font foi.</p>
      </Card>

      <Link to="/interventions" className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline">Voir les interventions<ChevronRight size={15} /></Link>
    </div>
  )
}
