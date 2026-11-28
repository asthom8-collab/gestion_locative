import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useInterventions } from '../../hooks/useInterventions'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Plus, Wrench, ChevronRight } from '../icons'
import { eur } from '../../lib/format'
import { InterventionList } from './InterventionList'
import { InterventionModal } from './InterventionModal'

/** Bloc « Interventions » de la fiche du bail : travaux faits pendant ce bail. */
export function LeaseInterventionsCard({ leaseId, propertyId }: { leaseId: string; propertyId: string }) {
  const { data, isLoading } = useInterventions({ leaseId })
  const [adding, setAdding] = useState(false)
  const items = data?.items ?? []
  return (
    <Card className="mb-4">
      <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-2">
        <h3 className="font-semibold tracking-tight flex items-center gap-2"><Wrench size={18} className="text-indigo-600" />Interventions pendant le bail</h3>
        <Button variant="ghost" onClick={() => setAdding(true)}><Plus size={15} />Ajouter</Button>
      </div>
      {isLoading ? null : items.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-slate-500">Aucune intervention : notez ici les travaux et réparations faits pendant ce bail.</p>
      ) : (
        <div className="px-5 pb-4">
          <InterventionList items={items} showProperty={false} />
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 text-sm">
            <Link to={`/interventions?property=${propertyId}`} className="inline-flex items-center gap-1 text-indigo-600 hover:underline">Toutes les interventions du bien<ChevronRight size={15} /></Link>
            {data && data.totals.ownerCost > 0 && <span className="text-slate-500">Dépenses {eur(data.totals.ownerCost)}</span>}
          </div>
        </div>
      )}
      {adding && <InterventionModal defaults={{ propertyId, leaseId }} onClose={() => setAdding(false)} />}
    </Card>
  )
}
