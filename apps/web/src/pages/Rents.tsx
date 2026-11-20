import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  useRentPayments, useGenerateRentPayments, useRecordPayment, useCancelPayment,
  useDeleteRentPayment, useGenerateReceipt,
} from '../hooks/useRentPayments'
import { api } from '../api/client'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Field, inputCls } from '../components/ui/Field'
import { Empty } from '../components/ui/Empty'
import { StatCard } from '../components/ui/StatCard'
import { Receipt, ChevronLeft, ChevronRight, Check, Download, Euro, CircleCheck, AlertCircle, Plus } from '../components/icons'
import { PaymentStatusBadge } from '../components/ui/PaymentStatusBadge'
import type { RentPayment } from '../types'

const eur = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
const monthTitle = (year: number, month: number) => {
  const s = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}
const today = () => new Date().toISOString().slice(0, 10)

/** Période affichée seulement si elle ne couvre pas le mois entier (prorata). */
function isProrata(p: RentPayment) {
  const start = new Date(p.periodStart)
  const end = new Date(p.periodEnd)
  const lastDay = new Date(Date.UTC(p.periodYear, p.periodMonth, 0)).getUTCDate()
  return start.getUTCDate() !== 1 || end.getUTCDate() !== lastDay
}

const linkBtn = 'text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 inline-flex items-center gap-1.5'

export function Rents() {
  const now = new Date()
  const [params] = useSearchParams()
  const [{ year, month }, setPeriod] = useState(() => {
    const y = Number(params.get('year')), m = Number(params.get('month'))
    return y && m >= 1 && m <= 12 ? { year: y, month: m } : { year: now.getFullYear(), month: now.getMonth() + 1 }
  })
  const shift = (delta: number) => setPeriod(({ year, month }) => {
    const d = new Date(Date.UTC(year, month - 1 + delta, 1))
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 }
  })

  const { data: payments = [], isLoading } = useRentPayments(year, month)
  const generateM = useGenerateRentPayments()
  const recordM = useRecordPayment()
  const cancelM = useCancelPayment()
  const deleteM = useDeleteRentPayment()
  const receiptM = useGenerateReceipt()

  const [paying, setPaying] = useState<RentPayment | null>(null)
  const [form, setForm] = useState({ amount: 0, date: today() })
  const [error, setError] = useState<string | null>(null)

  // Les erreurs d'API (ex. adresse du bailleur manquante) s'affichent en haut de la page
  const run = async (fn: () => Promise<unknown>) => {
    setError(null)
    try { await fn() } catch (e) { setError(e instanceof Error ? e.message : 'Erreur inconnue') }
  }

  const openPay = (p: RentPayment) => {
    setForm({ amount: p.receivedAmount ?? p.expectedAmount, date: p.paymentDate?.slice(0, 10) ?? today() })
    setPaying(p)
  }
  const savePayment = () => run(async () => {
    if (!paying) return
    await recordM.mutateAsync({ id: paying.id, receivedAmount: form.amount, paymentDate: new Date(form.date).toISOString() })
    setPaying(null)
  })
  const generate = () => run(() => generateM.mutateAsync({ year, month }))

  const expected = payments.reduce((s, p) => s + p.expectedAmount, 0)
  const received = payments.reduce((s, p) => s + (p.receivedAmount ?? 0), 0)
  const late = payments.filter(p => p.status === 'LATE' || p.status === 'PARTIAL').length

  return (
    <div>
      <PageHeader title="Loyers" subtitle="Encaissements et quittances"
        action={<Button onClick={generate} disabled={generateM.isPending}><Plus size={16} />Générer le mois</Button>} />

      <div className="flex items-center justify-between mb-4">
        <button onClick={() => shift(-1)} aria-label="Mois précédent" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"><ChevronLeft size={18} /></button>
        <h3 className="font-semibold text-slate-900">{monthTitle(year, month)}</h3>
        <button onClick={() => shift(1)} aria-label="Mois suivant" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"><ChevronRight size={18} /></button>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
          {/Paramètres/.test(error) && <> — <Link to="/settings" className="underline font-medium">ouvrir les Paramètres</Link></>}
        </div>
      )}

      {payments.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <StatCard Icon={Euro} label="Attendu" value={eur(expected)} tone="indigo" />
          <StatCard Icon={CircleCheck} label="Encaissé" value={eur(received)} tone="green" />
          <StatCard Icon={AlertCircle} label="Impayés" value={late} tone={late ? 'amber' : 'slate'} />
        </div>
      )}

      {isLoading ? (
        <div className="text-slate-400 text-sm py-8 text-center">Chargement…</div>
      ) : payments.length === 0 ? (
        <Card>
          <Empty Icon={Receipt} title="Aucune échéance ce mois-ci"
            hint="Générez les échéances à partir des baux en cours."
            action={{ label: 'Générer le mois', onClick: generate }} />
        </Card>
      ) : (
        <div className="space-y-3">
          {payments.map(p => (
            <Card key={p.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900 truncate">{p.lease.property.name}</span>
                    <PaymentStatusBadge status={p.status} />
                  </div>
                  <div className="text-sm text-slate-600 mt-0.5">{p.lease.tenant.firstName} {p.lease.tenant.lastName}</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {isProrata(p) ? `Du ${fmtDay(p.periodStart)} au ${fmtDay(p.periodEnd)} (prorata) · ` : ''}
                    Échéance le {fmtDay(p.dueDate)}
                    {p.paymentDate && ` · payé le ${fmtDay(p.paymentDate)}`}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold text-slate-900">{eur(p.expectedAmount)}</div>
                  {p.receivedAmount !== null && p.receivedAmount !== p.expectedAmount && (
                    <div className="text-xs text-amber-600">reçu {eur(p.receivedAmount)}</div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-3">
                {p.status !== 'RECEIVED' && (
                  <button className={linkBtn} onClick={() => openPay(p)}><Check size={14} />Encaisser</button>
                )}
                {p.status === 'RECEIVED' && !p.receipt && (
                  <button className={linkBtn} disabled={receiptM.isPending}
                    onClick={() => run(() => receiptM.mutateAsync(p.id))}>
                    <Receipt size={14} />Établir la quittance
                  </button>
                )}
                {p.receipt && (
                  <>
                    <a className={linkBtn} href={api.rentPayments.receiptUrl(p.id)} target="_blank" rel="noreferrer"><Receipt size={14} />Voir la quittance</a>
                    <a className={linkBtn} href={api.rentPayments.receiptUrl(p.id, true)}><Download size={14} />Télécharger</a>
                  </>
                )}
                {p.receivedAmount !== null && (
                  <button className={linkBtn} onClick={() => openPay(p)}>Modifier le paiement</button>
                )}
                {p.receivedAmount !== null && (
                  <button className={`${linkBtn} text-rose-600`}
                    onClick={() => confirm('Annuler ce paiement ? La quittance éventuelle sera supprimée.') && run(() => cancelM.mutateAsync(p.id))}>
                    Annuler le paiement
                  </button>
                )}
                {p.receivedAmount === null && (
                  <button className={`${linkBtn} text-rose-600`}
                    onClick={() => confirm('Supprimer cette échéance ?') && run(() => deleteM.mutateAsync(p.id))}>
                    Supprimer
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {paying && (
        <Modal title={`Encaisser — ${paying.lease.property.name}`} onClose={() => setPaying(null)}>
          <p className="text-sm text-slate-600 mb-4">
            Montant attendu : <strong>{eur(paying.expectedAmount)}</strong> (loyer {eur(paying.rentAmount)} + charges {eur(paying.chargesAmount)})
          </p>
          <Field label="Montant total reçu (€)">
            <input type="number" step="0.01" min="0" className={inputCls} value={form.amount}
              onChange={e => setForm({ ...form, amount: Number(e.target.value) })} />
          </Field>
          <Field label="Date du paiement">
            <input type="date" className={inputCls} value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          </Field>
          {form.amount > 0 && form.amount < paying.expectedAmount && (
            <p className="text-xs text-amber-600 mb-3">Paiement partiel : la quittance ne pourra être établie qu’une fois le loyer soldé.</p>
          )}
          <div className="flex justify-end">
            <Button onClick={savePayment} disabled={recordM.isPending || !(form.amount > 0) || !form.date}><Check size={16} />Enregistrer</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
