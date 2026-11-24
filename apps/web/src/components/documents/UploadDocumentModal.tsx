import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { ErrorAlert } from '../ui/ErrorAlert'
import { Field, inputCls } from '../ui/Field'
import { Upload } from '../icons'
import { useUploadDocument } from '../../hooks/useDocuments'
import { useActionError } from '../../hooks/useActionError'
import {
  ACCEPTED_FILES, DOCUMENT_CATEGORIES, LEASE_CATEGORIES, MAX_DOCUMENT_BYTES, PROPERTY_CATEGORIES, fmtSize, leaseOptionLabel,
} from '../../lib/documents'
import type { DocumentCategory, DocumentTarget, Lease, Property } from '../../types'

interface Props {
  onClose: () => void
  /** Rattachement imposé (fiche du bail, bien filtré) ; sinon, choix parmi les biens et les baux */
  target?: DocumentTarget
  properties?: Pick<Property, 'id' | 'name'>[]
  leases?: Lease[]
}

const encodeTarget = (t?: DocumentTarget) => (!t ? '' : 'leaseId' in t ? `lease:${t.leaseId}` : `property:${t.propertyId}`)
const decodeTarget = (v: string): DocumentTarget | undefined => {
  const [kind, id] = v.split(':')
  return !id ? undefined : kind === 'lease' ? { leaseId: id } : { propertyId: id }
}

/** Les types utiles au rattachement d'abord, puis les autres. */
function categoryOrder(target?: DocumentTarget): DocumentCategory[] {
  const first = target && 'propertyId' in target ? PROPERTY_CATEGORIES : LEASE_CATEGORIES
  return [...first, ...(Object.keys(DOCUMENT_CATEGORIES) as DocumentCategory[]).filter(c => !first.includes(c))]
}

export function UploadDocumentModal({ onClose, target: fixed, properties = [], leases = [] }: Props) {
  const [targetValue, setTargetValue] = useState(encodeTarget(fixed))
  const target = fixed ?? decodeTarget(targetValue)
  const order = categoryOrder(target)
  const [category, setCategory] = useState<DocumentCategory>(order[0])
  const [label, setLabel] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const uploadM = useUploadDocument()
  const { error, run, setError } = useActionError()

  const changeTarget = (v: string) => {
    setTargetValue(v)
    setCategory(categoryOrder(decodeTarget(v))[0])
  }
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
    if (!target || !file) return
    const ok = await run(() => uploadM.mutateAsync({ target, category, file, label: label.trim() || undefined }))
    if (ok) onClose()
  }

  return (
    <Modal title="Ajouter un document" onClose={onClose}>
      <ErrorAlert message={error} />
      {!fixed && (
        <Field label="Rattacher à">
          <select className={inputCls} value={targetValue} onChange={e => changeTarget(e.target.value)}>
            <option value="">Choisir un bien ou un bail…</option>
            {properties.length > 0 && (
              <optgroup label="Biens (diagnostics, taxe foncière, factures…)">
                {properties.map(p => <option key={p.id} value={`property:${p.id}`}>{p.name}</option>)}
              </optgroup>
            )}
            {leases.length > 0 && (
              <optgroup label="Baux (contrat, états des lieux, assurance…)">
                {leases.map(l => <option key={l.id} value={`lease:${l.id}`}>{leaseOptionLabel(l)}</option>)}
              </optgroup>
            )}
          </select>
        </Field>
      )}
      <Field label="Type de document">
        <select className={inputCls} value={category} onChange={e => setCategory(e.target.value as DocumentCategory)}>
          {order.map(c => <option key={c} value={c}>{DOCUMENT_CATEGORIES[c]}</option>)}
        </select>
      </Field>
      <Field label="Fichier (PDF, image, Word, Excel ; 15 Mo au plus)">
        <input type="file" accept={ACCEPTED_FILES} className={inputCls} onChange={e => pick(e.target.files?.[0] ?? null)} />
      </Field>
      <Field label="Nom affiché (facultatif)">
        <input className={inputCls} value={label} placeholder={file?.name ?? 'Nom du fichier par défaut'} maxLength={200}
          onChange={e => setLabel(e.target.value)} />
      </Field>
      <div className="flex justify-end">
        <Button onClick={submit} disabled={!target || !file || uploadM.isPending}>
          <Upload size={16} />{uploadM.isPending ? 'Envoi…' : 'Envoyer'}
        </Button>
      </div>
    </Modal>
  )
}
