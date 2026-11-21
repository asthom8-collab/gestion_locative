import { useState } from 'react'
import { api } from '../../api/client'
import { useRevisions, useRevisionPreview, useApplyRevision, useCancelRevision, useSaveIrl } from '../../hooks/useRevisions'
import { useActionError } from '../../hooks/useActionError'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Field, inputCls } from '../ui/Field'
import { ErrorAlert } from '../ui/ErrorAlert'
import { TrendingUp, FileText, Mail, Check, Undo2 } from '../icons'
import { eur, fmtDate, fullName } from '../../lib/format'
import type { LeaseDetail, RentRevision } from '../../types'

const irl = (v: number) => v.toLocaleString('fr-FR', { minimumFractionDigits: 2 })
const linkBtn = 'text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 inline-flex items-center gap-1.5'

/** Courrier prérempli dans la messagerie (comme dans la maquette), en plus du PDF. */
export function revisionMailto(lease: LeaseDetail, r: RentRevision) {
  const subject = `Révision annuelle du loyer — ${lease.property.name}`
  const body = `Bonjour ${fullName(lease.tenant)},\n\n` +
    `Conformément à l'article 17-1 de la loi du 6 juillet 1989 et à la clause de révision de votre bail, le loyer du logement situé ` +
    `${lease.property.address}, ${lease.property.zipCode} ${lease.property.city} est révisé à compter du ${fmtDate(r.effectiveDate)} ` +
    `selon l'indice de référence des loyers (IRL) publié par l'INSEE.\n\n` +
    `  • IRL de référence (T${r.previousIrlQuarter} ${r.previousIrlYear}) : ${irl(r.previousIrlValue)}\n` +
    `  • Nouvel IRL (T${r.previousIrlQuarter} ${r.newIrlYear}) : ${irl(r.newIrlValue)}\n` +
    `  • Loyer actuel hors charges : ${eur(r.previousRent)}\n` +
    `  • Nouveau loyer hors charges : ${eur(r.newRent)}\n` +
    `  • Charges mensuelles : ${eur(lease.chargesAmount)}\n` +
    `  • Nouveau total mensuel : ${eur(r.newRent + lease.chargesAmount)}\n\n` +
    `L'avis de révision signé est joint à ce message.\n\nBien cordialement,`
  return `mailto:${lease.tenant.email ?? ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

function RevisionModal({ lease, onClose }: { lease: LeaseDetail; onClose: () => void }) {
  const [date, setDate] = useState<string | undefined>(undefined)
  const iso = date ? new Date(`${date}T00:00:00.000Z`).toISOString() : undefined
  const { data: p, isLoading } = useRevisionPreview(lease.id, iso)
  const applyM = useApplyRevision()
  const saveIrlM = useSaveIrl()
  const { error, run } = useActionError()
  const [rent, setRent] = useState<string>('')
  const [irlValue, setIrlValue] = useState('')
  const [done, setDone] = useState<RentRevision | null>(null)

  if (done) return (
    <Modal title="Loyer révisé" onClose={onClose}>
      <p className="text-sm text-slate-600 mb-4">
        Nouveau loyer : <strong>{eur(done.newRent)}</strong> hors charges à compter du <strong>{fmtDate(done.effectiveDate)}</strong>.
        Les échéances déjà générées et pas encore payées ont été recalculées.
      </p>
      <div className="flex flex-wrap gap-2 justify-end">
        <a className={linkBtn} href={api.revisions.letterUrl(lease.id, done.id)} target="_blank" rel="noreferrer"><FileText size={13} />Avis de révision (PDF)</a>
        <a className={linkBtn} href={revisionMailto(lease, done)}><Mail size={13} />Ouvrir dans ma messagerie</a>
      </div>
    </Modal>
  )

  const effective = date ?? p?.effectiveDate.slice(0, 10) ?? ''
  const submit = async () => {
    if (!p?.computedRent) return
    const newRent = rent === '' ? undefined : Number(rent)
    let result: RentRevision | null = null
    await run(async () => { result = await applyM.mutateAsync({ leaseId: lease.id, effectiveDate: new Date(`${effective}T00:00:00.000Z`).toISOString(), newRent }) })
    if (result) setDone(result)
  }

  return (
    <Modal title="Réviser le loyer" onClose={onClose}>
      <ErrorAlert message={error} />
      <Field label="Date d'effet">
        <input type="date" className={inputCls} value={effective} min={p?.nextRevisionDate.slice(0, 10)} onChange={e => setDate(e.target.value || undefined)} />
      </Field>
      {p && <p className="text-xs text-slate-500 -mt-1 mb-3">Une révision par an au plus : pas avant le {fmtDate(p.nextRevisionDate)}. La révision n'est pas rétroactive.</p>}
      {isLoading || !p ? <p className="text-sm text-slate-400">Calcul…</p> : p.missing === 'INDEX' ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm mb-3">
          <p className="text-amber-800 mb-2">
            L'indice du <strong>T{p.expectedIndex!.quarter} {p.expectedIndex!.year}</strong> n'est pas encore saisi (ou pas encore publié à cette date).
            Valeur sur insee.fr (« Indice de référence des loyers »).
          </p>
          <div className="flex gap-2">
            <input aria-label={`IRL T${p.expectedIndex!.quarter} ${p.expectedIndex!.year}`} type="number" step="0.01" className={inputCls} value={irlValue} onChange={e => setIrlValue(e.target.value)} placeholder="ex. 145,47" />
            <Button disabled={!irlValue || saveIrlM.isPending} onClick={() => run(() => saveIrlM.mutateAsync({ ...p.expectedIndex!, value: Number(irlValue) }))}>Enregistrer</Button>
          </div>
        </div>
      ) : p.missing === null && p.reference && p.newIndex && p.computedRent !== null ? (
        <>
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm space-y-1 mb-3">
            <div className="flex justify-between"><span>IRL de référence (T{p.reference.quarter} {p.reference.year})</span><span>{irl(p.reference.value)}</span></div>
            <div className="flex justify-between"><span>Nouvel IRL (T{p.newIndex.quarter} {p.newIndex.year})</span><span>{irl(p.newIndex.value)}</span></div>
            <div className="flex justify-between"><span>Loyer actuel</span><span>{eur(p.currentRent)}</span></div>
            <div className="flex justify-between font-semibold"><span>Loyer révisé (maximum)</span><span>{eur(p.computedRent)}</span></div>
          </div>
          <Field label="Nouveau loyer hors charges (€)">
            <input type="number" step="0.01" className={inputCls} value={rent === '' ? p.computedRent : rent} max={p.computedRent} onChange={e => setRent(e.target.value)} />
          </Field>
          <p className="text-xs text-slate-500 -mt-1 mb-3">Vous pouvez appliquer moins que le maximum, jamais plus.</p>
          <div className="flex justify-end"><Button onClick={submit} disabled={applyM.isPending}><Check size={16} />Appliquer la révision</Button></div>
        </>
      ) : null}
    </Modal>
  )
}

/** Révision annuelle du loyer selon l'IRL : proposition, application, avis et historique. */
export function RevisionCard({ lease, onEditLease }: { lease: LeaseDetail; onEditLease: () => void }) {
  const { data: p } = useRevisionPreview(lease.id)
  const { data: revisions = [] } = useRevisions(lease.id)
  const cancelM = useCancelRevision()
  const { error, run, clear } = useActionError()
  const [open, setOpen] = useState(false)

  return (
    <Card className="p-5 mb-4">
      <div className="flex items-center justify-between mb-3 gap-3">
        <h3 className="font-semibold tracking-tight flex items-center gap-2"><TrendingUp size={18} className="text-indigo-600" />Révision du loyer (IRL)</h3>
        {lease.active && p && p.missing !== 'REFERENCE' && <Button variant="ghost" onClick={() => { clear(); setOpen(true) }}>Réviser le loyer</Button>}
      </div>
      <ErrorAlert message={error} onClose={clear} />
      {p?.missing === 'REFERENCE' ? (
        <p className="text-sm text-slate-500">
          Pour réviser le loyer, indiquez l'IRL de référence du bail (valeur, trimestre et année).{' '}
          <button className="text-indigo-600 underline" onClick={onEditLease}>Modifier le bail</button>
        </p>
      ) : p && lease.active ? (
        new Date(p.nextRevisionDate) <= new Date()
          ? <p className="text-sm text-slate-500">Révision possible <strong className="text-slate-700">dès maintenant</strong> (anniversaire du {fmtDate(p.nextRevisionDate)} passé ; la révision n'est pas rétroactive).</p>
          : <p className="text-sm text-slate-500">Prochaine révision possible à partir du <strong className="text-slate-700">{fmtDate(p.nextRevisionDate)}</strong>.</p>
      ) : null}
      {revisions.length > 0 && (
        <div className="divide-y divide-slate-100 mt-3">
          {revisions.map((r, i) => (
            <div key={r.id} className="flex items-center justify-between py-3 gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">{fmtDate(r.effectiveDate)} : {eur(r.previousRent)} → {eur(r.newRent)}</div>
                <div className="text-xs text-slate-500 mt-0.5">IRL T{r.previousIrlQuarter} {r.previousIrlYear} ({irl(r.previousIrlValue)}) → T{r.previousIrlQuarter} {r.newIrlYear} ({irl(r.newIrlValue)})</div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <a className={linkBtn} href={api.revisions.letterUrl(lease.id, r.id)} target="_blank" rel="noreferrer"><FileText size={13} />Avis</a>
                <a className={linkBtn} href={revisionMailto(lease, r)} aria-label="Envoyer par e-mail"><Mail size={13} /></a>
                {i === 0 && (
                  <button className={linkBtn} aria-label="Annuler la révision" disabled={cancelM.isPending}
                    onClick={() => confirm('Annuler cette révision ? Le loyer et l’IRL de référence reviendront à leurs valeurs précédentes.') && run(() => cancelM.mutateAsync({ leaseId: lease.id, id: r.id }))}>
                    <Undo2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {open && <RevisionModal lease={lease} onClose={() => setOpen(false)} />}
    </Card>
  )
}
