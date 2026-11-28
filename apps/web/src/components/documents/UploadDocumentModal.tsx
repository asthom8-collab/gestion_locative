import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { ErrorAlert } from '../ui/ErrorAlert'
import { Field, inputCls } from '../ui/Field'
import { Upload } from '../icons'
import { useUploadDocument } from '../../hooks/useDocuments'
import { useActionError } from '../../hooks/useActionError'
import { ACCEPTED_FILES, DOCUMENT_CATEGORIES, INTERVENTION_CATEGORIES, LEASE_CATEGORIES, MAX_DOCUMENT_BYTES, PROPERTY_CATEGORIES, fmtSize } from '../../lib/documents'
import { CategoryPicker } from './CategoryPicker'
import type { DocumentCategory, DocumentTarget } from '../../types'

/** Les types utiles au rattachement d'abord, puis les autres. */
function categoryOrder(target: DocumentTarget): DocumentCategory[] {
  const first = 'interventionId' in target ? INTERVENTION_CATEGORIES : 'propertyId' in target ? PROPERTY_CATEGORIES : LEASE_CATEGORIES
  return [...first, ...(Object.keys(DOCUMENT_CATEGORIES) as DocumentCategory[]).filter(c => !first.includes(c))]
}

/** Ajout d'un document à un bien ou à un bail (le rattachement vient de l'écran d'où l'on part). */
export function UploadDocumentModal({ target, title, onClose, initialCategory }: {
  target: DocumentTarget
  /** Nom du bien ou du bail, rappelé dans le titre */
  title?: string
  onClose: () => void
  initialCategory?: DocumentCategory
}) {
  const order = categoryOrder(target)
  const [category, setCategory] = useState<DocumentCategory>(initialCategory ?? order[0])
  const [label, setLabel] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const uploadM = useUploadDocument()
  const { error, run, setError } = useActionError()

  const pick = (f: File | null) => {
    setError(null)
    if (f && f.size > MAX_DOCUMENT_BYTES) {
      setError(`Fichier trop lourd (${fmtSize(f.size)}) : 15 Mo au plus`)
      setFile(null)
      return
    }
    setFile(f)
  }
  const submit = async () => {
    if (!file) return
    const ok = await run(() => uploadM.mutateAsync({ target, category, file, label: label.trim() || undefined }))
    if (ok) onClose()
  }

  return (
    <Modal title={title ? `Ajouter un document — ${title}` : 'Ajouter un document'} onClose={onClose}>
      <ErrorAlert message={error} />
      <CategoryPicker value={category} onChange={setCategory} order={order} />
      <Field label="Fichier (PDF, image, Word, Excel ; 15 Mo au plus)">
        <input type="file" accept={ACCEPTED_FILES} className={inputCls} onChange={e => pick(e.target.files?.[0] ?? null)} />
      </Field>
      <Field label="Nom affiché (facultatif)">
        <input className={inputCls} value={label} placeholder={file?.name ?? 'Nom du fichier par défaut'} maxLength={200}
          onChange={e => setLabel(e.target.value)} />
      </Field>
      <div className="flex justify-end">
        <Button onClick={submit} disabled={!file || uploadM.isPending}>
          <Upload size={16} />{uploadM.isPending ? 'Envoi…' : 'Envoyer'}
        </Button>
      </div>
    </Modal>
  )
}
