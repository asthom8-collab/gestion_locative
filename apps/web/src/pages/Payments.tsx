import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useYearRentPayments } from '../hooks/useRentPayments'
import { api } from '../api/client'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Empty } from '../components/ui/Empty'
import { StatCard } from '../components/ui/StatCard'
import { inputCls } from '../components/ui/Field'
import { AlertCircle, ChevronLeft, ChevronRight, CircleCheck, CreditCard, Download, Euro, Receipt } from '../components/icons'
import type { RentPayment } from '../types'

const eur = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { timeZone: 'UTC' })
const monthLabel = (year: number, month: number) =>
  new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const tenantName = (p: RentPayment) => `${p.lease.tenant.firstName} ${p.lease.tenant.lastName}`
const remaining = (p: RentPayment) => Math.max(0, p.expectedAmount - (p.receivedAmount ?? 0))
const rentsLink = (p: RentPayment) => `/rents?year=${p.periodYear}&month=${p.periodMonth}`
const linkBtn = 'text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 inline-flex items-center gap-1.5'

/** Export du journal des encaissements, lisible par un tableur (séparateur « ; », virgule décimale, BOM pour Excel). */
function downloadCsv(rows: RentPayment[], year: number) {
  const num = (n: number | null) => (n ?? 0).toFixed(2).replace('.', ',')
  const cell = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const lines = [
    ['Date du paiement', 'Bien', 'Locataire', 'Mois', 'Loyer', 'Charges', 'Attendu', 'Reçu', 'Statut', 'Quittance'],
    ...rows.map(p => [
      p.paymentDate ? fmtDate(p.paymentDate) : '', p.lease.property.name, tenantName(p), monthLabel(p.periodYear, p.periodMonth),
      num(p.rentAmount), num(p.chargesAmount), num(p.expectedAmount), num(p.receivedAmount),
      p.status === 'PARTIAL' ? 'Partiel' : 'Payé', p.receipt ? 'oui' : 'non',
    ]),
  ]
  const blob = new Blob(['﻿' + lines.map(l => l.map(cell).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `encaissements-${year}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function Payments() {
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [propertyId, setPropertyId] = useState('')
  const { data: all = [], isLoading } = useYearRentPayments(year)

  const properties = useMemo(() => {
    const byId = new Map(all.map(p => [p.lease.property.id, p.lease.property.name]))
    return [...byId].sort((a, b) => a[1].localeCompare(b[1]))
  }, [all])
  const payments = propertyId ? all.filter(p => p.lease.property.id === propertyId) : all

  // Encaissements : du plus récent au plus ancien
  const received = payments
    .filter(p => p.receivedAmount !== null && p.paymentDate)
    .sort((a, b) => b.paymentDate!.localeCompare(a.paymentDate!))
  // À relancer : échéances en retard ou payées en partie, la plus ancienne d'abord
  const overdue = payments
    .filter(p => p.status === 'LATE' || p.status === 'PARTIAL')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  const today = new Date().toISOString()
  const expected = payments.filter(p => p.dueDate <= today).reduce((s, p) => s + p.expectedAmount, 0)
  const cashed = received.reduce((s, p) => s + (p.receivedAmount ?? 0), 0)
  const due = overdue.reduce((s, p) => s + remaining(p), 0)

  return (
    <div>
      <PageHeader title="Paiements" subtitle="Encaissements de l'année et loyers à relancer"
        action={received.length > 0 ? (
          <Button variant="ghost" onClick={() => downloadCsv(received, year)}><Download size={16} />Exporter (CSV)</Button>
        ) : undefined} />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-1">
          <button onClick={() => setYear(y => y - 1)} aria-label="Année précédente" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"><ChevronLeft size={18} /></button>
          <h3 className="font-semibold text-slate-900 w-14 text-center">{year}</h3>
          <button onClick={() => setYear(y => y + 1)} aria-label="Année suivante" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"><ChevronRight size={18} /></button>
        </div>
        {properties.length > 1 && (
          <select aria-label="Bien" className={`${inputCls} w-auto`} value={propertyId} onChange={e => setPropertyId(e.target.value)}>
            <option value="">Tous les biens</option>
            {properties.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        )}
      </div>

      {isLoading ? (
        <div className="text-slate-400 text-sm py-8 text-center">Chargement…</div>
      ) : payments.length === 0 ? (
        <Card>
          <Empty Icon={CreditCard} title={`Aucune échéance en ${year}`}
            hint="Les échéances se créent depuis la page Loyers (« Générer le mois »)." />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <StatCard Icon={CircleCheck} label="Encaissé" value={eur(cashed)} tone="green" />
            <StatCard Icon={Euro} label="Attendu à ce jour" value={eur(expected)} tone="indigo" />
            <StatCard Icon={AlertCircle} label="Reste dû" value={eur(due)} tone={due ? 'amber' : 'slate'} />
            <StatCard Icon={Receipt} label="Loyers à relancer" value={overdue.length} tone={overdue.length ? 'amber' : 'slate'} />
          </div>

          {overdue.length > 0 && (
            <section aria-label="À relancer" className="mb-6 rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
              <h3 className="font-semibold text-amber-900 flex items-center gap-2 mb-3">
                <AlertCircle size={18} />À relancer ({overdue.length})
              </h3>
              <div className="space-y-2">
                {overdue.map(p => (
                  <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white border border-amber-200 px-3 py-2.5">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900">{tenantName(p)} · {p.lease.property.name}</div>
                      <div className="text-xs text-slate-500">
                        {monthLabel(p.periodYear, p.periodMonth)} · échéance du {fmtDate(p.dueDate)}
                        {p.status === 'PARTIAL' && ` · reçu ${eur(p.receivedAmount ?? 0)} sur ${eur(p.expectedAmount)}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-amber-700">reste {eur(remaining(p))}</span>
                      <Link to={rentsLink(p)} className={linkBtn}>Encaisser</Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <h3 className="font-semibold text-slate-900 mb-2">Encaissements ({received.length})</h3>
          {received.length === 0 ? (
            <Card><Empty Icon={CreditCard} title="Aucun encaissement" hint="Les paiements enregistrés dans Loyers apparaissent ici." /></Card>
          ) : (
            <Card>
              <div className="divide-y divide-slate-100">
                {received.map(p => (
                  <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <Link to={`/leases/${p.leaseId}`} className="flex items-center gap-3 min-w-0 text-left">
                      <span className="shrink-0 grid place-items-center w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600"><CreditCard size={16} /></span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-slate-800 truncate">{tenantName(p)}</span>
                        <span className="block text-xs text-slate-500 truncate">
                          {p.lease.property.name} · {monthLabel(p.periodYear, p.periodMonth)} · payé le {fmtDate(p.paymentDate!)}
                        </span>
                      </span>
                    </Link>
                    <div className="flex items-center gap-3 shrink-0">
                      {p.status === 'PARTIAL' && <span className="text-[11px] font-medium text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">Partiel</span>}
                      <span className="font-semibold text-slate-900 text-sm">{eur(p.receivedAmount ?? 0)}</span>
                      {p.receipt
                        ? <a className={linkBtn} href={api.rentPayments.receiptUrl(p.id)} target="_blank" rel="noreferrer"><Receipt size={14} />Quittance</a>
                        : p.status === 'RECEIVED' && <Link to={rentsLink(p)} className={linkBtn}>Établir la quittance</Link>}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
