import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useProperties } from '../hooks/useProperties'
import { useMe } from '../hooks/useMe'
import { OwnersModal } from '../components/OwnersModal'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Empty } from '../components/ui/Empty'
import { PropTypeIcon } from '../components/ui/PropTypeIcon'
import { Building2, Pencil } from '../components/icons'
import { fmtDate, fullName } from '../lib/format'
import type { Ownership, Property } from '../types'

const pct = (share: number) => `${Math.round(share * 10000) / 100} %`
const day = (iso: string | null) => iso?.slice(0, 10) ?? null
const todayIso = () => new Date().toISOString().slice(0, 10)

/** Ancien (fin passée), futur (début à venir) ou actuel propriétaire. */
function status(o: Ownership, today: string) {
  if (day(o.endDate) && day(o.endDate)! < today) return { label: 'Ancien', cls: 'bg-slate-100 text-slate-500' }
  if (day(o.startDate) && day(o.startDate)! > today) return { label: 'À venir', cls: 'bg-indigo-50 text-indigo-700' }
  return { label: 'Actuel', cls: 'bg-emerald-50 text-emerald-700' }
}

function period(o: Ownership) {
  if (!o.startDate && !o.endDate) return 'Sans limite de dates'
  return `${o.startDate ? `Depuis le ${fmtDate(o.startDate)}` : 'Depuis toujours'} · ${o.endDate ? `jusqu'au ${fmtDate(o.endDate)}` : 'encore propriétaire'}`
}

function PropertyOwners({ property, highlighted, onEdit, meId }: { property: Property; highlighted: boolean; onEdit: () => void; meId?: string }) {
  const today = todayIso()
  // Chronologie : du plus ancien début au plus récent (début vide = depuis toujours, en premier)
  const owners = [...(property.ownerships ?? [])].sort((a, b) => (day(a.startDate) ?? '').localeCompare(day(b.startDate) ?? ''))
  const current = owners.filter(o => status(o, today).label === 'Actuel')
  const total = Math.round(current.reduce((s, o) => s + o.share, 0) * 10000) / 100

  return (
    <Card className={`p-5 ${highlighted ? 'ring-2 ring-indigo-400' : ''}`}>
      <div id={`owners-${property.id}`} className="flex items-center justify-between gap-3 mb-3 scroll-mt-24">
        <h3 className="font-semibold tracking-tight flex items-center gap-2 min-w-0"><PropTypeIcon type={property.type} size={16} /><span className="truncate">{property.name}</span></h3>
        <Button variant="ghost" onClick={onEdit}><Pencil size={14} />Modifier<span className="sr-only"> les propriétaires de {property.name}</span></Button>
      </div>
      <div className="divide-y divide-slate-100">
        {owners.map(o => {
          const s = status(o, today)
          return (
            <div key={o.id} className="py-2 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-800 truncate">
                  {fullName(o.user)}{o.userId === meId && <span className="text-slate-400 font-normal"> (vous)</span>}
                </div>
                <div className="text-xs text-slate-500">{period(o)}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>
                <span className="text-sm font-semibold w-16 text-right">{pct(o.share)}</span>
              </div>
            </div>
          )
        })}
      </div>
      {total !== 100 && (
        <p className="text-xs text-amber-700 mt-2">Total des quotes-parts aujourd'hui : {total} % (100 % attendu).</p>
      )}
    </Card>
  )
}

/**
 * Propriétaires de chaque bien (quotes-parts et dates de détention). Les comptes se gèrent dans Paramètres
 * (administrateur). `?property=<id>` met un bien en évidence (liens depuis les pages Biens et Charges).
 */
export function Owners() {
  const { data: properties = [], isLoading } = useProperties()
  const { data: me } = useMe()
  const [params] = useSearchParams()
  const focus = params.get('property')
  const [editing, setEditing] = useState<Property | null>(null)

  useEffect(() => {
    if (focus && !isLoading) document.getElementById(`owners-${focus}`)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  }, [focus, isLoading])

  if (isLoading) return <div className="text-slate-400 text-sm py-8 text-center">Chargement…</div>

  return (
    <div>
      <PageHeader title="Propriétaires" subtitle="Qui détient chaque bien, avec quelle quote-part et depuis quand" />
      <div className="space-y-4 max-w-3xl">
        <Card className="p-4 text-sm text-slate-600">
          La quote-part sert à répartir les charges entre propriétaires (et servira pour les impôts). Pour un changement de
          propriétaire (vente, donation…), cliquez sur <strong>Modifier</strong> : mettez une date « jusqu'au » à l'ancien
          propriétaire (la veille) et une date « depuis le » au nouveau (le jour du changement).
        </Card>
        {properties.length === 0 ? (
          <Card><Empty Icon={Building2} title="Aucun bien" hint="Ajoutez d'abord un bien dans la page Biens." /></Card>
        ) : properties.map(p => (
          <PropertyOwners key={p.id} property={p} highlighted={p.id === focus} onEdit={() => setEditing(p)} meId={me?.id} />
        ))}
      </div>
      {editing && <OwnersModal property={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
