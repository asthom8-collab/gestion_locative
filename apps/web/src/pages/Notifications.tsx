import { Link } from 'react-router-dom'
import { useNotifications, useMarkRead, useMarkAllRead } from '../hooks/useNotifications'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { BellRing, Check } from '../components/icons'
import type { AppNotification } from '../types'

const when = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

/** Lien interne (/leases/…) ou vers l'adresse publique de l'application (APP_URL) : on garde le chemin. */
const internalPath = (link: string) => (link.startsWith('/') ? link : new URL(link).pathname)

function Item({ n }: { n: AppNotification }) {
  const readM = useMarkRead()
  const read = () => { if (!n.readAt) readM.mutate(n.id) }
  return (
    <Card className={`p-4 ${n.readAt ? '' : 'border-l-4 border-l-indigo-500'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className={`text-sm ${n.readAt ? 'text-slate-700' : 'font-semibold text-slate-900'}`}>{n.title}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{when(n.createdAt)}</p>
        </div>
        {!n.readAt && (
          <button onClick={read} aria-label={`Marquer « ${n.title} » comme lue`} title="Marquer comme lue"
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-indigo-600 shrink-0"><Check size={15} /></button>
        )}
      </div>
      <p className="text-sm text-slate-600 whitespace-pre-line mt-2">{n.body}</p>
      {n.link && <Link to={internalPath(n.link)} onClick={read} className="inline-block mt-2 text-sm text-indigo-600 underline">{n.leaseId ? 'Ouvrir le bail' : 'Ouvrir'}</Link>}
    </Card>
  )
}

/** Notifications : rappels avant l'anniversaire des baux (révision du loyer), messages d'essai. */
export function Notifications() {
  const { data = [], isLoading } = useNotifications()
  const allM = useMarkAllRead()
  const unread = data.filter(n => !n.readAt).length
  return (
    <div>
      <PageHeader title="Notifications" subtitle="Rappels avant la date anniversaire des baux, pour préparer la révision du loyer"
        action={unread > 0 ? <Button variant="ghost" onClick={() => allM.mutate()} disabled={allM.isPending}><Check size={16} />Tout marquer comme lu</Button> : undefined} />
      {isLoading ? <p className="text-sm text-slate-400">Chargement…</p> : data.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-500">
          <BellRing className="mx-auto mb-2 text-slate-300" size={28} />
          Aucune notification. Le délai de prévenance et les canaux (e-mail, téléphone) se règlent dans Paramètres.
        </Card>
      ) : <div className="space-y-3">{data.map(n => <Item key={n.id} n={n} />)}</div>}
    </div>
  )
}
