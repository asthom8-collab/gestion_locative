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
import { OwnersModal } from '../components/OwnersModal'
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Check, X, Users2 } from '../components/icons'
import { eur, fmtDate } from '../lib/format'
import type { Charge, ChargeAllocation, Property } from '../types'

export const periodLabel = (quarter: number | null) => (quarter ? `T${quarter}` : 'Année')

/** Période d'une charge : l'année entière (montant annuel) ou un trimestre de l'année affichée. */
export const PERIODS: { value: number | null; label: string }[] = [
  { value: null, label: 'Toute l’année' },
  { value: 1, label: '1er trimestre (janv.–mars)' },
  { value: 2, label: '2e trimestre (avr.–juin)' },
  { value: 3, label: '3e trimestre (juil.–sept.)' },
  { value: 4, label: '4e trimestre (oct.–déc.)' },
]

function PeriodSelect({ value, onChange, label, className = '' }: { value: number | null; onChange: (q: number | null) => void; label: string; className?: string }) {
  return (
    <select aria-label={label} className={`${inputCls} min-w-0 ${className}`} value={value ?? ''} onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}>
      {PERIODS.map(p => <option key={p.value ?? 0} value={p.value ?? ''}>{p.label}</option>)}
    </select>
  )
}

/** Grille du formulaire : sur mobile, période et libellé sur toute la largeur, puis montant et bouton. */
const formGrid = 'grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[13rem_minmax(0,1fr)_8rem_auto] gap-2 items-center'

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
      <div className={formGrid}>
        <PeriodSelect label="Période" className="col-span-2 sm:col-span-1" value={edit.quarter} onChange={quarter => setEdit({ ...edit, quarter })} />
        <input aria-label="Libellé" className={`${inputCls} min-w-0 col-span-2 sm:col-span-1`} value={edit.label} onChange={e => setEdit({ ...edit, label: e.target.value })} />
        <input aria-label="Montant" type="number" inputMode="decimal" step="0.01" className={`${inputCls} min-w-0`} value={edit.amount} onChange={e => setEdit({ ...edit, amount: e.target.value })} />
        <div className="flex">
        <button aria-label="Enregistrer" className="p-2 rounded-lg hover:bg-slate-100 text-indigo-600" onClick={async () => { if (await run(() => updateM.mutateAsync({ id: c.id, data: { label: edit.label, amount: Number(edit.amount), quarter: edit.quarter } }))) setEdit(null) }}><Check size={16} /></button>
        <button aria-label="Annuler" className="p-2 rounded-lg hover:bg-slate-100 text-slate-400" onClick={() => setEdit(null)}><X size={16} /></button>
        </div>
      </div>
    </div>
  )
  return (
    <div className="flex items-center justify-between py-2 gap-3 text-sm">
      <span className="min-w-0 truncate">
        <span title={PERIODS.find(p => p.value === c.quarter)?.label} className="inline-block w-12 mr-2 text-center rounded bg-slate-100 text-slate-500 text-xs py-0.5">{periodLabel(c.quarter)}</span>{c.label}
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

function PropertyCharges({ property, year, charges, allocation }: { property: Property; year: number; charges: Charge[]; allocation?: ChargeAllocation }) {
  const createM = useCreateCharge()
  const { error, run, clear } = useActionError()
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [quarter, setQuarter] = useState<number | null>(null)
  const [ownersOpen, setOwnersOpen] = useState(false)
  const total = charges.reduce((s, c) => s + c.amount, 0)
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
      <button onClick={() => setOwnersOpen(true)} className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700">
        <Users2 size={13} />Propriétaires, quotes-parts et dates de détention<span className="sr-only"> de {property.name}</span>
      </button>
      {ownersOpen && <OwnersModal property={property} onClose={() => setOwnersOpen(false)} />}
      <ErrorAlert message={error} onClose={clear} />
      {charges.length === 0 ? <p className="text-sm text-slate-400 py-2">Aucune charge saisie pour {year}.</p> : (
        <div className="divide-y divide-slate-100">{charges.map(c => <ChargeLine key={c.id} c={c} />)}</div>
      )}
      <div className="mt-3 rounded-lg bg-slate-50 p-3">
        <p className="text-xs font-medium text-slate-600 mb-2">Ajouter une charge de {year}</p>
        <div className={formGrid}>
          <PeriodSelect label={`Période pour ${property.name}`} className="col-span-2 sm:col-span-1" value={quarter} onChange={setQuarter} />
          <input aria-label={`Nouvelle charge pour ${property.name}`} list={listId} className={`${inputCls} min-w-0 col-span-2 sm:col-span-1`} placeholder="Libellé (ex. eau, ordures ménagères…)" value={label} onChange={e => setLabel(e.target.value)} />
          <datalist id={listId}>{SUGGESTIONS.map(s => <option key={s} value={s} />)}</datalist>
          <input aria-label={`Montant pour ${property.name}`} type="number" inputMode="decimal" step="0.01" className={`${inputCls} min-w-0`} placeholder="Montant en €" value={amount} onChange={e => setAmount(e.target.value)} />
          <Button onClick={add} disabled={!label.trim() || !amount || createM.isPending}><Plus size={16} /><span>Ajouter</span><span className="sr-only"> à {property.name}</span></Button>
        </div>
      </div>
      {allocation && <Allocation a={allocation} year={year} />}
    </Card>
  )
}

const period = (start: string | null, end: string | null) =>
  start && end ? `du ${fmtDate(start)} au ${fmtDate(end)}` : start ? `depuis le ${fmtDate(start)}` : end ? `jusqu'au ${fmtDate(end)}` : ''

/** Dates d'un bail ramenées à l'année affichée. */
const inYear = (t: ChargeAllocation['tenants'][number], year: number) => {
  const s = t.startDate.slice(0, 10) > `${year}-01-01` ? t.startDate : null
  const e = t.endDate && t.endDate.slice(0, 10) < `${year}-12-31` ? t.endDate : null
  return s || e ? period(s, e) : 'toute l’année'
}

/**
 * Répartition des charges de l'année d'un bien :
 * - entre locataires : part refacturable de chaque bail (jours occupés dans la période de chaque charge), provisions
 *   déjà appelées et solde de la régularisation ; ce qui tombe pendant la vacance reste aux propriétaires ;
 * - entre propriétaires (s'il y en a plusieurs) : quote-part × jours de détention dans la période de chaque charge.
 */
function Allocation({ a, year }: { a: ChargeAllocation; year: number }) {
  const showOwners = a.owners.length > 1 || a.owners.some(o => o.startDate || o.endDate)
  return (
    <div className="mt-4 pt-3 border-t border-slate-100">
      <h4 className="text-sm font-semibold text-slate-700">À refacturer aux locataires</h4>
      <p className="text-xs text-slate-500 mb-2">Chaque charge au prorata des jours occupés dans sa période (trimestre ou année), moins les provisions déjà payées.</p>
      {a.tenants.length === 0 ? <p className="text-sm text-slate-400">Aucun bail sur {year}.</p> : (
        <div className="divide-y divide-slate-100 text-sm">
          {a.tenants.map(t => (
            <div key={t.leaseId} className="py-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <div className="min-w-0">
                <Link to={`/leases/${t.leaseId}`} className="font-medium text-indigo-600 underline">{t.tenantName}</Link>
                <span className="text-slate-400 text-xs"> · {inYear(t, year)} ({t.occupiedDays} j)</span>
                <div className="text-xs text-slate-500">
                  Part réelle {eur(t.share)} − provisions {eur(t.provisions)} = <span className={t.balance > 0 ? 'text-amber-700 font-medium' : 'text-emerald-700 font-medium'}>
                    {t.balance > 0 ? `${eur(t.balance)} à réclamer` : t.balance < 0 ? `${eur(-t.balance)} à rembourser` : 'soldé'}</span>
                  {t.missingMonths.length > 0 && <span className="text-amber-700"> · {t.missingMonths.length} mois sans échéance générée</span>}
                </div>
              </div>
              <Link to={`/leases/${t.leaseId}`} className={`text-xs shrink-0 rounded-full px-2 py-0.5 ${t.regularization ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'}`}>
                {t.regularization ? 'Régularisée' : 'Régulariser'}
              </Link>
            </div>
          ))}
          {a.vacancy > 0 && (
            <div className="py-2 flex items-center justify-between gap-3 text-slate-500">
              <span>Logement vacant : reste à la charge des propriétaires</span><span className="font-medium shrink-0">{eur(a.vacancy)}</span>
            </div>
          )}
        </div>
      )}
      {showOwners && <>
        <h4 className="text-sm font-semibold text-slate-700 mt-4">Entre propriétaires</h4>
        <p className="text-xs text-slate-500 mb-1">Quote-part × jours de détention dans la période de chaque charge.</p>
        <div className="divide-y divide-slate-100 text-sm">
          {a.owners.map(o => (
            <div key={o.userId} className="flex items-center justify-between gap-3 py-1.5">
              <span className="min-w-0">{o.name} <span className="text-slate-400">({Math.round(o.share * 10000) / 100} %{period(o.startDate, o.endDate) && `, ${period(o.startDate, o.endDate)}`})</span></span>
              <span className="font-medium shrink-0">{eur(o.amount)}</span>
            </div>
          ))}
        </div>
      </>}
    </div>
  )
}

/** Charges récupérables réelles par bien, par année ou par trimestre : base de la régularisation annuelle. */
export function Charges() {
  const [params, setParams] = useSearchParams()
  const year = Number(params.get('year')) || new Date().getFullYear() - 1
  const setYear = (y: number) => setParams({ year: String(y) })
  const { data: properties = [], isLoading } = useProperties()
  const { data: charges = [] } = useCharges(year)
  const { data: allocation = [] } = useChargeAllocation(year)

  return (
    <div>
      <PageHeader title="Charges" subtitle="Charges récupérables réelles de l’année, pour toute l’année ou par trimestre, refacturées à chaque locataire au prorata de son occupation" />
      <div className="flex items-center gap-2 mb-4">
        <button aria-label="Année précédente" onClick={() => setYear(year - 1)} className="p-2 rounded-lg hover:bg-slate-100"><ChevronLeft size={18} /></button>
        <span className="text-lg font-semibold w-16 text-center">{year}</span>
        <button aria-label="Année suivante" onClick={() => setYear(year + 1)} className="p-2 rounded-lg hover:bg-slate-100"><ChevronRight size={18} /></button>
      </div>
      {isLoading ? <p className="text-sm text-slate-400">Chargement…</p> : properties.length === 0 ? (
        <p className="text-sm text-slate-500">Ajoutez d'abord un bien.</p>
      ) : <>
        {properties.map(p => (
          <PropertyCharges key={p.id} property={p} year={year} charges={charges.filter(c => c.propertyId === p.id)} allocation={allocation.find(a => a.propertyId === p.id)} />
        ))}
      </>}
    </div>
  )
}
