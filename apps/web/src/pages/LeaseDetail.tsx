import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useLease, useUpdateLease, useTerminateLease } from '../hooks/useLeases'
import { useLeaseRentPayments, useGenerateReceipt } from '../hooks/useRentPayments'
import { useActionError } from '../hooks/useActionError'
import { useOutdatedRegularizations } from '../hooks/useCharges'
import { api } from '../api/client'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Field, inputCls } from '../components/ui/Field'
import { ErrorAlert } from '../components/ui/ErrorAlert'
import { PaymentStatusBadge } from '../components/ui/PaymentStatusBadge'
import { PropTypeIcon } from '../components/ui/PropTypeIcon'
import { RevisionCard } from '../components/lease/RevisionCard'
import { RegularizationCard } from '../components/lease/RegularizationCard'
import { LeaseDocumentsCard } from '../components/documents/LeaseDocumentsCard'
import { ArrowLeft, Mail, Phone, Pencil, Receipt, Download, Check, Ban, ChevronRight, AlertCircle } from '../components/icons'
import { eur, fmtDate, fullName, durationLabel } from '../lib/format'
import type { LeaseDetail as LeaseDetailT, LeaseType, RentPayment, UpdateLeaseInput } from '../types'

const LEASE_TYPES: Record<LeaseType, string> = { UNFURNISHED: 'Location nue', FURNISHED: 'Location meublée' }
const today = () => new Date().toISOString().slice(0, 10)
const monthTitle = (p: RentPayment) => {
  const s = new Date(Date.UTC(p.periodYear, p.periodMonth - 1, 1)).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}
const linkBtn = 'text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 inline-flex items-center gap-1.5'

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-slate-400">{label}</div>
      <div className="font-medium mt-0.5">{value}</div>
    </div>
  )
}

/** Échéances du bail (encaissement sur la page Loyers) et quittances. */
function PaymentsCard({ leaseId }: { leaseId: string }) {
  const { data: payments = [], isLoading } = useLeaseRentPayments(leaseId)
  const receiptM = useGenerateReceipt()
  const { error, run, clear } = useActionError()
  const received = payments.reduce((s, p) => s + (p.receivedAmount ?? 0), 0)

  return (
    <Card className="p-5 mb-4">
      <div className="flex items-center justify-between mb-3 gap-3">
        <h3 className="font-semibold tracking-tight flex items-center gap-2"><Receipt size={18} className="text-indigo-600" />Échéances et quittances</h3>
        {payments.length > 0 && <span className="text-xs text-slate-500">{eur(received)} encaissés au total</span>}
      </div>
      <ErrorAlert message={error} onClose={clear} />
      {error && /Paramètres/.test(error) && (
        <p className="-mt-2 mb-3 text-xs"><Link to="/settings" className="text-indigo-600 underline">Ouvrir les Paramètres</Link></p>
      )}
      {isLoading ? (
        <p className="text-sm text-slate-400 py-2">Chargement…</p>
      ) : payments.length === 0 ? (
        <p className="text-sm text-slate-400 py-2">Aucune échéance pour l'instant. Elles se génèrent mois par mois depuis la page <Link to="/rents" className="text-indigo-600 underline">Loyers</Link>.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {payments.map(p => (
            <div key={p.id} className="flex items-center justify-between py-3 gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{monthTitle(p)}</span>
                  <PaymentStatusBadge status={p.status} />
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {eur(p.expectedAmount)}
                  {p.receivedAmount !== null && p.receivedAmount !== p.expectedAmount && ` · reçu ${eur(p.receivedAmount)}`}
                  {p.paymentDate && ` · payé le ${fmtDate(p.paymentDate)}`}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                {p.receipt ? (
                  <>
                    <a href={api.rentPayments.receiptUrl(p.id)} target="_blank" rel="noreferrer" className={linkBtn}><Receipt size={13} />Quittance</a>
                    <a href={api.rentPayments.receiptUrl(p.id, true)} aria-label={`Télécharger la quittance de ${monthTitle(p)}`} className={linkBtn}><Download size={13} /></a>
                  </>
                ) : p.status === 'RECEIVED' ? (
                  <button className={linkBtn} disabled={receiptM.isPending} onClick={() => run(() => receiptM.mutateAsync(p.id))}>
                    <Receipt size={13} />Établir la quittance
                  </button>
                ) : (
                  <Link to={`/rents?year=${p.periodYear}&month=${p.periodMonth}`} className={linkBtn}>Encaisser<ChevronRight size={13} /></Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

export function LeaseDetail() {
  const { id = '' } = useParams()
  const { data: lease, isLoading, error: loadError } = useLease(id)
  const updateM = useUpdateLease()
  const terminateM = useTerminateLease()
  const modalErr = useActionError()

  const [editing, setEditing] = useState<UpdateLeaseInput | null>(null)
  const [terminating, setTerminating] = useState<string | null>(null)
  // Régularisations de ce bail devenues fausses : bandeau en haut, qui ouvre la carte sur l'année concernée
  const { data: allOutdated = [] } = useOutdatedRegularizations()
  const [regYear, setRegYear] = useState<number | undefined>(undefined)

  if (isLoading) return <div className="text-slate-400 text-sm py-8 text-center">Chargement…</div>
  if (!lease) return (
    <div>
      <BackLink />
      <ErrorAlert message={loadError instanceof Error ? loadError.message : 'Bail introuvable'} />
    </div>
  )

  const openEdit = (l: LeaseDetailT) => {
    modalErr.clear()
    setEditing({ type: l.type, rentAmount: l.rentAmount, chargesAmount: l.chargesAmount, rentDayOfMonth: l.rentDayOfMonth, irlReference: l.irlReference ?? undefined, irlQuarter: l.irlQuarter ?? undefined, irlYear: l.irlYear ?? undefined })
  }
  const saveEdit = async () => {
    if (!editing) return
    if (await modalErr.run(() => updateM.mutateAsync({ id: lease.id, data: editing }))) setEditing(null)
  }
  const openTerminate = () => { modalErr.clear(); setTerminating(today()) }
  const saveTerminate = async () => {
    if (!terminating) return
    if (await modalErr.run(() => terminateM.mutateAsync({ id: lease.id, endDate: new Date(terminating).toISOString() }))) setTerminating(null)
  }

  const { property: p, tenant: t } = lease
  const irl = lease.irlReference
    ? `${lease.irlReference}${lease.irlQuarter && lease.irlYear ? ` (T${lease.irlQuarter} ${lease.irlYear})` : ''}`
    : '—'

  const outdated = allOutdated.filter(r => r.leaseId === lease.id)
  const showRegularization = (year: number) => {
    setRegYear(year)
    requestAnimationFrame(() => document.getElementById('regularisation')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }))
  }

  return (
    <div>
      <BackLink />
      {outdated.map(r => (
        <div key={r.id} role="note" className="mb-4 flex flex-wrap items-center gap-3 p-4 rounded-xl border border-amber-300 bg-amber-50">
          <AlertCircle size={18} className="shrink-0 text-amber-500" />
          <div className="flex-1 min-w-[12rem] text-sm text-amber-900">
            <span className="font-semibold">Régularisation {r.year} à refaire</span> : les charges ont changé depuis son enregistrement
            (solde enregistré {eur(r.balance)}{r.currentBalance != null && `, recalculé ${eur(r.currentBalance)}`}).
          </div>
          <Button onClick={() => showRegularization(r.year)}>Voir et mettre à jour</Button>
        </div>
      ))}
      <Card className="p-5 mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-semibold tracking-tight">{fullName(t)}</h2>
              <Badge ok={lease.active} on="En cours" off="Terminé" />
            </div>
            <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
              {t.email && <a href={`mailto:${t.email}`} className="flex items-center gap-1 hover:text-indigo-600"><Mail size={11} className="text-slate-400" />{t.email}</a>}
              {t.phone && <a href={`tel:${t.phone}`} className="flex items-center gap-1 hover:text-indigo-600"><Phone size={11} className="text-slate-400" />{t.phone}</a>}
            </div>
            <p className="text-sm text-slate-500 mt-2 flex items-center gap-2">
              <PropTypeIcon type={p.type} size={13} />
              <span className="truncate"><span className="text-slate-700 font-medium">{p.name}</span> · {p.address}, {p.zipCode} {p.city}</span>
            </p>
          </div>
          <div className="flex gap-1 shrink-0">
            <button onClick={() => openEdit(lease)} aria-label="Modifier le bail" className="p-2 rounded-lg hover:bg-slate-100 text-slate-400"><Pencil size={16} /></button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 text-sm">
          <Info label="Loyer + charges" value={eur(lease.rentAmount + lease.chargesAmount)} />
          <Info label="Dont charges" value={eur(lease.chargesAmount)} />
          <Info label="Type" value={LEASE_TYPES[lease.type]} />
          <Info label="Échéance" value={`le ${lease.rentDayOfMonth} du mois`} />
          <Info label="Début" value={fmtDate(lease.startDate)} />
          <Info label="Fin" value={lease.endDate ? fmtDate(lease.endDate) : '—'} />
          <Info label="Durée" value={durationLabel(lease.startDate, lease.active ? null : lease.endDate)} />
          <Info label="IRL de référence" value={irl} />
        </div>
        {lease.active && (
          <div className="mt-5 pt-4 border-t border-slate-100 flex justify-end">
            <Button variant="ghost" onClick={openTerminate}><Ban size={15} />Résilier le bail</Button>
          </div>
        )}
      </Card>

      <PaymentsCard leaseId={lease.id} />
      <RevisionCard lease={lease} onEditLease={() => openEdit(lease)} />
      <div id="regularisation" className="scroll-mt-4"><RegularizationCard key={regYear} lease={lease} initialYear={regYear} /></div>
      <LeaseDocumentsCard leaseId={lease.id} />

      {editing && (
        <Modal title="Modifier le bail" onClose={() => setEditing(null)}>
          <ErrorAlert message={modalErr.error} />
          <Field label="Type">
            <select className={inputCls} value={editing.type} onChange={e => setEditing({ ...editing, type: e.target.value as LeaseType })}>
              {Object.entries(LEASE_TYPES).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Loyer hors charges (€)">
              <input type="number" className={inputCls} value={editing.rentAmount} onChange={e => setEditing({ ...editing, rentAmount: Number(e.target.value) })} />
            </Field>
            <Field label="Charges (€)">
              <input type="number" className={inputCls} value={editing.chargesAmount} onChange={e => setEditing({ ...editing, chargesAmount: Number(e.target.value) })} />
            </Field>
          </div>
          <Field label="Jour d'échéance du loyer (1-28)">
            <input type="number" min={1} max={28} className={inputCls} value={editing.rentDayOfMonth} onChange={e => setEditing({ ...editing, rentDayOfMonth: Number(e.target.value) })} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="IRL de référence">
              <input type="number" step="0.01" className={inputCls} value={editing.irlReference ?? ''} onChange={e => setEditing({ ...editing, irlReference: e.target.value === '' ? undefined : Number(e.target.value) })} />
            </Field>
            <Field label="Trimestre (1-4)">
              <input type="number" min={1} max={4} className={inputCls} value={editing.irlQuarter ?? ''} onChange={e => setEditing({ ...editing, irlQuarter: e.target.value === '' ? undefined : Number(e.target.value) })} />
            </Field>
            <Field label="Année">
              <input type="number" className={inputCls} value={editing.irlYear ?? ''} onChange={e => setEditing({ ...editing, irlYear: e.target.value === '' ? undefined : Number(e.target.value) })} />
            </Field>
          </div>
          <p className="text-xs text-slate-500 -mt-1 mb-3">L'IRL de référence est celui indiqué dans le bail (ou celui de la dernière révision). Les nouveaux montants s'appliquent aux échéances générées ensuite. Celles déjà générées gardent leurs montants.</p>
          <div className="flex justify-end"><Button onClick={saveEdit} disabled={updateM.isPending}><Check size={16} />Enregistrer</Button></div>
        </Modal>
      )}

      {terminating !== null && (
        <Modal title="Résilier le bail" onClose={() => setTerminating(null)}>
          <ErrorAlert message={modalErr.error} />
          <Field label="Date de fin (incluse)">
            <input type="date" className={inputCls} value={terminating} min={lease.startDate.slice(0, 10)} onChange={e => setTerminating(e.target.value)} />
          </Field>
          <p className="text-xs text-slate-500 -mt-1 mb-3">Le dernier mois sera calculé au prorata jusqu'à cette date. Le bien redeviendra vacant.</p>
          <div className="flex justify-end"><Button onClick={saveTerminate} disabled={terminateM.isPending}><Ban size={15} />Confirmer la résiliation</Button></div>
        </Modal>
      )}
    </div>
  )
}

function BackLink() {
  return (
    <Link to="/leases" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4">
      <ArrowLeft size={16} />Retour aux baux
    </Link>
  )
}
