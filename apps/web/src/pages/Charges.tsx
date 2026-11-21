import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useProperties } from '../hooks/useProperties'
import { useCharges, useCreateCharge, useUpdateCharge, useDeleteCharge, useChargeAllocation } from '../hooks/useCharges'
import { useActionError } from '../hooks/useActionError'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { inputCls } from '../components/ui/Field'
import { ErrorAlert } from '../components/ui/ErrorAlert'
import { PropTypeIcon } from '../components/ui/PropTypeIcon'
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Check, X } from '../components/icons'
import { eur, fmtDate } from '../lib/format'
import type { Charge, ChargeAllocation, Property } from '../types'

export const periodLabel = (quarter: number | null) => (quarter ? `T${quarter}` : 'Année')

function PeriodSelect({ value, onChange, label }: { value: number | null; onChange: (q: number | null) => void; label: string }) {
  return (
    <select aria-label={label} className={`${inputCls} w-24 shrink-0`} value={value ?? ''} onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}>
      <option value="">Année</option>
      {[1, 2, 3, 4].map(q => <option key={q} value={q}>T{q}</option>)}
    </select>
  )
}

/** Exemples de charges récupérables (décret n° 87-713 du 26 août 1987). */
const SUGGESTIONS = ['Taxe d’enlèvement des ordures ménagères', 'Eau froide et chaude', 'Charges de copropriété récupérables', 'Entretien des parties communes', 'Ascenseur', 'Chauffage collectif']

function ChargeLine({ c }: { c: Charge }) {
  const updateM = useUpdateCharge()
  const deleteM = useDeleteCharge()
  const { error, run } = useActionError()
  const [edit, setEdit] = useState<{ label: string; amount: string; quarter: number | null } | null>(null)
  if (edit) return (
    <div className="py-2">
      <ErrorAlert message={error} />
      <div className="flex gap-2 items-center">
        <PeriodSelect label="Période" value={edit.quarter} onChange={quarter => setEdit({ ...edit, quarter })} />
        <input aria-label="Libellé" className={inputCls} value={edit.label} onChange={e => setEdit({ ...edit, label: e.target.value })} />
        <input aria-label="Montant" type="number" step="0.01" className={`${inputCls} w-28`} value={edit.amount} onChange={e => setEdit({ ...edit, amount: e.target.value })} />
        <button aria-label="Enregistrer" className="p-2 rounded-lg hover:bg-slate-100 text-indigo-600" onClick={async () => { if (await run(() => updateM.mutateAsync({ id: c.id, data: { label: edit.label, amount: Number(edit.amount), quarter: edit.quarter } }))) setEdit(null) }}><Check size={16} /></button>
        <button aria-label="Annuler" className="p-2 rounded-lg hover:bg-slate-100 text-slate-400" onClick={() => setEdit(null)}><X size={16} /></button>
      </div>
    </div>
  )
  return (
    <div className="flex items-center justify-between py-2 gap-3 text-sm">
      <span className="min-w-0 truncate">
        <span className="inline-block w-12 mr-2 text-center rounded bg-slate-100 text-slate-500 text-xs py-0.5">{periodLabel(c.quarter)}</span>{c.label}
      </span>
      <div className="flex items-center gap-1 shrink-0">
        <span className="font-medium mr-2">{eur(c.amount)}</span>
        <button aria-label={`Modifier ${c.label}`} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400" onClick={() => setEdit({ label: c.label, amount: String(c.amount), quarter: c.quarter })}><Pencil size={14} /></button>
        <button aria-label={`Supprimer ${c.label}`} className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600" disabled={deleteM.isPending}
          onClick={() => confirm(`Supprimer « ${c.label} » ?`) && run(() => deleteM.mutateAsync(c.id))}><Trash2 size={14} /></button>
      </div>
    </div>
  )
}

function PropertyCharges({ property, year, charges }: { property: Property; year: number; charges: Charge[] }) {
  const createM = useCreateCharge()
  const { error, run, clear } = useActionError()
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [quarter, setQuarter] = useState<number | null>(null)
  const total = charges.reduce((s, c) => s + c.amount, 0)
  const leases = (property.leases ?? []).filter(l => new Date(l.startDate).getUTCFullYear() <= year && (!l.endDate || new Date(l.endDate).getUTCFullYear() >= year))
  const add = async () => {
    if (await run(() => createM.mutateAsync({ propertyId: property.id, year, quarter, label: label.trim(), amount: Number(amount) }))) { setLabel(''); setAmount('') }
  }
  const listId = `suggestions-${property.id}`

  return (
    <Card className="p-5 mb-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <h3 className="font-semibold tracking-tight flex items-center gap-2 min-w-0"><PropTypeIcon type={property.type} size={16} /><span className="truncate">{property.name}</span></h3>
        <span className="text-sm text-slate-500 shrink-0">Total {eur(total)}</span>
      </div>
      <ErrorAlert message={error} onClose={clear} />
      {charges.length === 0 ? <p className="text-sm text-slate-400 py-2">Aucune charge saisie pour {year}.</p> : (
        <div className="divide-y divide-slate-100">{charges.map(c => <ChargeLine key={c.id} c={c} />)}</div>
      )}
      <div className="flex gap-2 mt-3">
        <PeriodSelect label={`Période pour ${property.name}`} value={quarter} onChange={setQuarter} />
        <input aria-label={`Nouvelle charge pour ${property.name}`} list={listId} className={inputCls} placeholder="Libellé (ex. eau, ordures ménagères…)" value={label} onChange={e => setLabel(e.target.value)} />
        <datalist id={listId}>{SUGGESTIONS.map(s => <option key={s} value={s} />)}</datalist>
        <input aria-label={`Montant pour ${property.name}`} type="number" step="0.01" className={`${inputCls} w-28`} placeholder="€" value={amount} onChange={e => setAmount(e.target.value)} />
        <Button onClick={add} disabled={!label.trim() || !amount || createM.isPending}><Plus size={16} /><span className="sr-only">Ajouter à {property.name}</span></Button>
      </div>
      {leases.length > 0 && (
        <p className="text-xs text-slate-500 mt-3">
          Régulariser : {leases.map((l, i) => (
            <span key={l.id}>{i > 0 && ', '}<Link to={`/leases/${l.id}`} className="text-indigo-600 underline">{l.tenant ? `${l.tenant.firstName} ${l.tenant.lastName}` : 'bail'}</Link></span>
          ))}
        </p>
      )}
    </Card>
  )
}

const ownerPeriod = (o: ChargeAllocation['owners'][number]) =>
  o.startDate && o.endDate ? `du ${fmtDate(o.startDate)} au ${fmtDate(o.endDate)}`
    : o.startDate ? `depuis le ${fmtDate(o.startDate)}` : o.endDate ? `jusqu'au ${fmtDate(o.endDate)}` : ''

/**
 * Part des charges de l'année revenant à chaque propriétaire : quote-part × jours détenus dans la période de
 * chaque charge (trimestre ou année). Utile quand le bien change de propriétaire en cours d'année.
 */
function Allocation({ year }: { year: number }) {
  const { data = [] } = useChargeAllocation(year)
  const shown = data.filter(a => a.owners.length > 1)
  if (!shown.length) return null
  return (
    <Card className="p-5 mb-4">
      <h3 className="font-semibold tracking-tight mb-1">Répartition entre propriétaires</h3>
      <p className="text-xs text-slate-500 mb-3">Quote-part × jours de détention dans la période de chaque charge (trimestre ou année).</p>
      {shown.map(a => (
        <div key={a.propertyId} className="mb-3 last:mb-0">
          <div className="text-sm font-medium text-slate-700 mb-1">{a.propertyName} <span className="text-slate-400 font-normal">· {eur(a.total)}</span></div>
          <div className="divide-y divide-slate-100 text-sm">
            {a.owners.map(o => (
              <div key={o.userId} className="flex items-center justify-between gap-3 py-1.5">
                <span className="min-w-0">{o.name} <span className="text-slate-400">({Math.round(o.share * 10000) / 100} %{ownerPeriod(o) && `, ${ownerPeriod(o)}`})</span></span>
                <span className="font-medium shrink-0">{eur(o.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </Card>
  )
}

/** Charges récupérables réelles par bien, par année ou par trimestre : base de la régularisation annuelle. */
export function Charges() {
  const [params, setParams] = useSearchParams()
  const year = Number(params.get('year')) || new Date().getFullYear() - 1
  const setYear = (y: number) => setParams({ year: String(y) })
  const { data: properties = [], isLoading } = useProperties()
  const { data: charges = [] } = useCharges(year)

  return (
    <div>
      <PageHeader title="Charges" subtitle="Charges récupérables réelles, par année ou par trimestre, à répartir entre les locataires lors de la régularisation annuelle" />
      <div className="flex items-center gap-2 mb-4">
        <button aria-label="Année précédente" onClick={() => setYear(year - 1)} className="p-2 rounded-lg hover:bg-slate-100"><ChevronLeft size={18} /></button>
        <span className="text-lg font-semibold w-16 text-center">{year}</span>
        <button aria-label="Année suivante" onClick={() => setYear(year + 1)} className="p-2 rounded-lg hover:bg-slate-100"><ChevronRight size={18} /></button>
      </div>
      {isLoading ? <p className="text-sm text-slate-400">Chargement…</p> : properties.length === 0 ? (
        <p className="text-sm text-slate-500">Ajoutez d'abord un bien.</p>
      ) : <>
        {properties.map(p => (
          <PropertyCharges key={p.id} property={p} year={year} charges={charges.filter(c => c.propertyId === p.id)} />
        ))}
        <Allocation year={year} />
      </>}
    </div>
  )
}
