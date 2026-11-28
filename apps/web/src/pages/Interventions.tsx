import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useInterventions } from '../hooks/useInterventions'
import { useProperties } from '../hooks/useProperties'
import { useLeases } from '../hooks/useLeases'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Empty } from '../components/ui/Empty'
import { StatCard } from '../components/ui/StatCard'
import { inputCls } from '../components/ui/Field'
import { Plus, Wrench, Euro, CircleCheck, TrendingUp, Clock } from '../components/icons'
import { InterventionList } from '../components/interventions/InterventionList'
import { InterventionModal } from '../components/interventions/InterventionModal'
import { INTERVENTION_KINDS } from '../lib/interventions'
import { eur } from '../lib/format'
import type { InterventionKind } from '../types'

/** Travaux des biens : liste filtrable par bien, type et année, avec les dépenses et leur traitement aux impôts. */
export function Interventions() {
  const [params, setParams] = useSearchParams()
  const propertyId = params.get('property') || undefined
  const kind = (params.get('kind') || undefined) as InterventionKind | undefined
  const year = Number(params.get('year')) || undefined
  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value); else next.delete(key)
    setParams(next)
  }
  const { data: properties = [] } = useProperties()
  useLeases() // chargés d'avance : le formulaire propose le bail en cours dès le choix du bien
  const { data, isLoading } = useInterventions({ propertyId, kind, year })
  const [adding, setAdding] = useState(false)
  const items = data?.items ?? []
  const years = [...new Set([...(data?.years ?? []), ...(year ? [year] : [])])].sort((a, b) => b - a)
  const filtered = !!(propertyId || kind || year)

  return (
    <div>
      <PageHeader title="Interventions" subtitle="Travaux faits vous-même ou par un professionnel, et leur traitement aux impôts"
        action={<Button onClick={() => setAdding(true)}><Plus size={16} />Nouvelle intervention</Button>} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
        <select aria-label="Filtrer par bien" className={inputCls} value={propertyId ?? ''} onChange={e => setFilter('property', e.target.value)}>
          <option value="">Tous les biens</option>
          {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select aria-label="Filtrer par type" className={inputCls} value={kind ?? ''} onChange={e => setFilter('kind', e.target.value)}>
          <option value="">Tous les types</option>
          {Object.entries(INTERVENTION_KINDS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
        <select aria-label="Filtrer par année" className={inputCls} value={year ?? ''} onChange={e => setFilter('year', e.target.value)}>
          <option value="">Toutes les années</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {data && items.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <StatCard Icon={Euro} tone="indigo" label="Dépenses (faites, à votre charge)" value={eur(data.totals.ownerCost)} />
          <StatCard Icon={CircleCheck} tone="green" label="Déductible ou en charges" value={eur(data.totals.deductible)} />
          <StatCard Icon={TrendingUp} tone="slate" label="À amortir (LMNP au réel)" value={eur(data.totals.depreciable)} />
          <StatCard Icon={Clock} tone="amber" label="Prévues" value={eur(data.totals.planned)} />
        </div>
      )}

      {isLoading ? <p className="text-sm text-slate-400">Chargement…</p> : items.length === 0 ? (
        <Card>
          {filtered
            ? <Empty Icon={Wrench} title="Aucune intervention pour ces filtres" hint="Changez de bien, de type ou d’année." />
            : <Empty Icon={Wrench} title="Aucune intervention" hint="Notez les travaux et réparations de vos biens : ils comptent aux impôts."
                action={properties.length ? { label: 'Ajouter une intervention', onClick: () => setAdding(true) } : undefined} />}
        </Card>
      ) : (
        <Card className="px-5 py-2"><InterventionList items={items} showProperty={!propertyId} /></Card>
      )}
      <p className="text-xs text-slate-400 mt-3">
        Le traitement fiscal dépend du régime du bien (fiche du bien) et de la nature des travaux :{' '}
        <Link to="/tax-rules" className="text-indigo-600 hover:underline">règles fiscales des travaux</Link>. Les montants détaillés par
        déclaration viendront avec l’écran Impôts.
      </p>

      {adding && <InterventionModal defaults={{ propertyId }} onClose={() => setAdding(false)} />}
    </div>
  )
}
