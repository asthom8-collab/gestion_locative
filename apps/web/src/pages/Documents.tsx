import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useDocuments } from '../hooks/useDocuments'
import { useProperties } from '../hooks/useProperties'
import { useLeases } from '../hooks/useLeases'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Empty } from '../components/ui/Empty'
import { inputCls } from '../components/ui/Field'
import { Paperclip, Upload } from '../components/icons'
import { DocumentList } from '../components/documents/DocumentList'
import { UploadDocumentModal } from '../components/documents/UploadDocumentModal'
import { DOCUMENT_CATEGORIES } from '../lib/documents'
import type { DocumentCategory } from '../types'

export function Documents() {
  const [params, setParams] = useSearchParams()
  const propertyId = params.get('property') ?? ''
  const [category, setCategory] = useState<DocumentCategory | ''>('')
  const { data: docs = [], isLoading } = useDocuments({ propertyId: propertyId || undefined, category: category || undefined })
  const { data: properties = [] } = useProperties()
  const { data: leases = [] } = useLeases()
  const [adding, setAdding] = useState(false)

  const setProperty = (id: string) => setParams(id ? { property: id } : {}, { replace: true })
  const filtered = !!propertyId || !!category
  // Ajout depuis un bien filtré : ce bien et ses baux seulement
  const leaseChoices = propertyId ? leases.filter(l => l.propertyId === propertyId) : leases
  const propertyChoices = propertyId ? properties.filter(p => p.id === propertyId) : properties

  return (
    <div>
      <PageHeader title="Documents" subtitle="Documents des biens et des baux"
        action={<Button onClick={() => setAdding(true)}><Upload size={16} />Ajouter</Button>} />

      <div className="flex flex-wrap gap-3 mb-4">
        <select aria-label="Bien" className={`${inputCls} w-auto`} value={propertyId} onChange={e => setProperty(e.target.value)}>
          <option value="">Tous les biens</option>
          {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select aria-label="Type" className={`${inputCls} w-auto`} value={category} onChange={e => setCategory(e.target.value as DocumentCategory | '')}>
          <option value="">Tous les types</option>
          {(Object.keys(DOCUMENT_CATEGORIES) as DocumentCategory[]).map(c => <option key={c} value={c}>{DOCUMENT_CATEGORIES[c]}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="text-slate-400 text-sm py-8 text-center">Chargement…</div>
      ) : docs.length === 0 ? (
        <Card>
          <Empty Icon={Paperclip} title={filtered ? 'Aucun document pour ce filtre' : 'Aucun document'}
            hint="Contrats, états des lieux, assurances, diagnostics, taxe foncière, factures : tout au même endroit."
            action={{ label: 'Ajouter un document', onClick: () => setAdding(true) }} />
        </Card>
      ) : (
        <>
          <p className="text-xs text-slate-500 mb-2">{docs.length} document{docs.length > 1 ? 's' : ''}{propertyId && ' (bien et baux de ce bien)'}</p>
          <Card><DocumentList docs={docs} /></Card>
        </>
      )}

      {adding && (
        <UploadDocumentModal onClose={() => setAdding(false)} properties={propertyChoices} leases={leaseChoices} />
      )}
    </div>
  )
}
