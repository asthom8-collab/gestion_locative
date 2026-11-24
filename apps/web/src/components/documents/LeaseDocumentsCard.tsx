import { useState } from 'react'
import { useDocuments } from '../../hooks/useDocuments'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Paperclip, Upload } from '../icons'
import { DocumentList } from './DocumentList'
import { UploadDocumentModal } from './UploadDocumentModal'

/** Bloc « Documents » de la fiche du bail (contrat, états des lieux, assurance…). */
export function LeaseDocumentsCard({ leaseId }: { leaseId: string }) {
  const { data: docs = [], isLoading } = useDocuments({ leaseId })
  const [adding, setAdding] = useState(false)
  return (
    <Card className="mb-4">
      <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
        <h3 className="font-semibold tracking-tight flex items-center gap-2"><Paperclip size={18} className="text-indigo-600" />Documents du bail</h3>
        <Button variant="ghost" onClick={() => setAdding(true)}><Upload size={15} />Ajouter</Button>
      </div>
      {isLoading ? null : docs.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-slate-500">Aucun document : ajoutez le contrat signé, les états des lieux, l'attestation d'assurance…</p>
      ) : (
        <div className="pb-2"><DocumentList docs={docs} showAttachment={false} /></div>
      )}
      {adding && <UploadDocumentModal target={{ leaseId }} onClose={() => setAdding(false)} />}
    </Card>
  )
}
