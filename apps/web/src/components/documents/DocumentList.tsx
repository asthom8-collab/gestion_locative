import { useState } from 'react'
import { api } from '../../api/client'
import { useDeleteDocument, useUpdateDocument } from '../../hooks/useDocuments'
import { useActionError } from '../../hooks/useActionError'
import { DOCUMENT_CATEGORIES, attachmentLabel, fmtSize } from '../../lib/documents'
import { fmtDate } from '../../lib/format'
import { CategoryPicker } from './CategoryPicker'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { ErrorAlert } from '../ui/ErrorAlert'
import { Field, inputCls } from '../ui/Field'
import { Check, Download, FileText, ImageIcon, Pencil, Trash2 } from '../icons'
import type { DocumentCategory, DocumentItem } from '../../types'

const iconBtn = 'p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700'

/** Liste de documents : ouvrir, télécharger, renommer / changer le type, supprimer. */
export function DocumentList({ docs, showAttachment = true, showCategory = true }: { docs: DocumentItem[]; showAttachment?: boolean; showCategory?: boolean }) {
  const [editing, setEditing] = useState<DocumentItem | null>(null)
  const [form, setForm] = useState<{ label: string; category: DocumentCategory }>({ label: '', category: 'OTHER' })
  const updateM = useUpdateDocument()
  const deleteM = useDeleteDocument()
  const { error, run } = useActionError()
  const modalErr = useActionError()

  const openEdit = (d: DocumentItem) => {
    modalErr.clear()
    setForm({ label: d.label, category: d.category })
    setEditing(d)
  }
  const save = async () => {
    if (!editing) return
    if (await modalErr.run(() => updateM.mutateAsync({ id: editing.id, label: form.label.trim(), category: form.category }))) setEditing(null)
  }
  const remove = (d: DocumentItem) =>
    confirm(`Supprimer « ${d.label} » ? Le fichier sera effacé.`) && run(() => deleteM.mutateAsync(d.id))

  return (
    <>
      <ErrorAlert message={error} />
      <div className="divide-y divide-slate-100">
        {docs.map(d => (
          <div key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <a href={api.documents.fileUrl(d.id)} target="_blank" rel="noreferrer" className="flex items-center gap-3 min-w-0 text-left group">
              <span className="shrink-0 p-2 rounded-lg bg-slate-100 text-slate-500">
                {d.mimeType.startsWith('image/') ? <ImageIcon size={16} /> : <FileText size={16} />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-800 truncate group-hover:text-indigo-600">{d.label}</span>
                <span className="block text-xs text-slate-500 truncate">
                  {[showCategory && DOCUMENT_CATEGORIES[d.category], showAttachment && attachmentLabel(d), fmtDate(d.createdAt), fmtSize(d.size)].filter(Boolean).join(' · ')}
                </span>
              </span>
            </a>
            <div className="flex items-center gap-0.5 shrink-0">
              <a href={api.documents.fileUrl(d.id, true)} aria-label={`Télécharger ${d.label}`} title="Télécharger" className={iconBtn}><Download size={15} /></a>
              <button onClick={() => openEdit(d)} aria-label={`Modifier ${d.label}`} title="Renommer ou changer le type" className={iconBtn}><Pencil size={15} /></button>
              <button onClick={() => remove(d)} aria-label={`Supprimer ${d.label}`} title="Supprimer"
                className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600"><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <Modal title="Modifier le document" onClose={() => setEditing(null)}>
          <ErrorAlert message={modalErr.error} />
          <Field label="Nom affiché">
            <input className={inputCls} value={form.label} maxLength={200} onChange={e => setForm({ ...form, label: e.target.value })} />
          </Field>
          <CategoryPicker value={form.category} onChange={category => setForm({ ...form, category })} />
          <p className="text-xs text-slate-500 -mt-1 mb-3">Fichier d'origine : {editing.fileName}</p>
          <div className="flex justify-end">
            <Button onClick={save} disabled={!form.label.trim() || updateM.isPending}><Check size={16} />Enregistrer</Button>
          </div>
        </Modal>
      )}
    </>
  )
}
