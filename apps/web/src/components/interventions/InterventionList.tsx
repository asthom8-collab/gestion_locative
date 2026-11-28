import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { useDeleteIntervention } from '../../hooks/useInterventions'
import { useActionError } from '../../hooks/useActionError'
import { ErrorAlert } from '../ui/ErrorAlert'
import { Pencil, Trash2, Paperclip, Upload, HardHat, UserCircle2 } from '../icons'
import { UploadDocumentModal } from '../documents/UploadDocumentModal'
import { DOCUMENT_CATEGORIES } from '../../lib/documents'
import { DONE_BY, INTERVENTION_KINDS, PAID_BY, TAX_STYLE } from '../../lib/interventions'
import { eur, fmtDate, fullName } from '../../lib/format'
import { InterventionModal } from './InterventionModal'
import type { Intervention } from '../../types'

function Row({ i, showProperty, onEdit }: { i: Intervention; showProperty: boolean; onEdit: () => void }) {
  const deleteM = useDeleteIntervention()
  const { error, run, clear } = useActionError()
  const [uploading, setUploading] = useState(false)
  const remove = () => {
    const docs = i.documents.length ? ` Ses ${i.documents.length} document(s) restent dans les documents du bien.` : ''
    if (confirm(`Supprimer l’intervention « ${i.title} » ?${docs}`)) run(() => deleteM.mutateAsync(i.id))
  }
  const who = i.doneBy === 'PROFESSIONAL' ? i.providerName || DONE_BY.PROFESSIONAL : DONE_BY.OWNER
  return (
    <li className="py-3">
      <ErrorAlert message={error} onClose={clear} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-slate-900">{i.title}</span>
            {i.status === 'PLANNED' && <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700">Prévue</span>}
          </div>
          <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-x-1.5 gap-y-0.5 flex-wrap">
            <span>{fmtDate(i.date)}</span><span>·</span><span>{INTERVENTION_KINDS[i.kind]}</span><span>·</span>
            <span className="inline-flex items-center gap-1">{i.doneBy === 'PROFESSIONAL' ? <HardHat size={12} /> : <UserCircle2 size={12} />}{who}</span>
            {showProperty && <><span>·</span><span>{i.property.name}</span></>}
            {i.lease && <><span>·</span><Link to={`/leases/${i.lease.id}`} className="text-indigo-600 hover:underline">bail de {fullName(i.lease.tenant)}</Link></>}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${TAX_STYLE[i.tax.code]}`}>{i.tax.label}</span>
            {i.paidBy === 'OWNER' ? null : <span className="text-[11px] text-slate-400">Payée par {PAID_BY[i.paidBy].toLowerCase()}</span>}
          </div>
          {i.notes && <p className="text-xs text-slate-500 mt-1 whitespace-pre-line">{i.notes}</p>}
          <div className="mt-1.5 flex items-center gap-x-3 gap-y-1 flex-wrap text-xs">
            {i.documents.map(d => (
              <a key={d.id} href={api.documents.fileUrl(d.id)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo-600 hover:underline">
                <Paperclip size={11} />{d.label}<span className="text-slate-400">({DOCUMENT_CATEGORIES[d.category].toLowerCase()})</span>
              </a>
            ))}
            <button type="button" onClick={() => setUploading(true)} className="inline-flex items-center gap-1 text-slate-500 hover:text-indigo-600">
              <Upload size={11} />Joindre une facture ou un devis<span className="sr-only"> à {i.title}</span>
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className={`font-medium mr-1 ${i.paidBy === 'OWNER' ? '' : 'text-slate-400 line-through'}`}>{eur(i.cost)}</span>
          <button aria-label={`Modifier ${i.title}`} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400" onClick={onEdit}><Pencil size={14} /></button>
          <button aria-label={`Supprimer ${i.title}`} className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600" disabled={deleteM.isPending} onClick={remove}><Trash2 size={14} /></button>
        </div>
      </div>
      {uploading && <UploadDocumentModal target={{ interventionId: i.id }} title={i.title} initialCategory="INVOICE" onClose={() => setUploading(false)} />}
    </li>
  )
}

/** Liste des interventions, avec modification, suppression et ajout de factures ou devis. */
export function InterventionList({ items, showProperty = true }: { items: Intervention[]; showProperty?: boolean }) {
  const [editing, setEditing] = useState<Intervention | null>(null)
  return (
    <>
      <ul className="divide-y divide-slate-100">
        {items.map(i => <Row key={i.id} i={i} showProperty={showProperty} onEdit={() => setEditing(i)} />)}
      </ul>
      {editing && <InterventionModal intervention={editing} onClose={() => setEditing(null)} />}
    </>
  )
}
