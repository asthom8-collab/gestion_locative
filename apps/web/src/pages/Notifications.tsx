import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useNotifications, useMarkRead, useMarkAllRead, useUpcomingReminders, useCheckReminders } from '../hooks/useNotifications'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { BellRing, Check, RefreshCw } from '../components/icons'
import type { AppNotification, UpcomingReminder } from '../types'

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

const statusText = (u: UpcomingReminder) => ({
  planned: u.daysLeft <= 0 ? 'rappel le jour même' : `rappel à partir du ${when(u.remindOn)}`,
  sent: `rappel envoyé le ${u.sentAt ? when(u.sentAt) : ''}`,
  past: 'anniversaire passé : révision à faire dans la fiche du bail',
  not_owner: 'vous ne serez plus propriétaire à cette date : pas de rappel',
}[u.status])

/** Prochains anniversaires de bail et date d'envoi de chaque rappel, pour vérifier le réglage sans attendre. */
function Upcoming() {
  const { data = [] } = useUpcomingReminders()
  const checkM = useCheckReminders()
  const [result, setResult] = useState<string | null>(null)
  const check = async () => {
    setResult(null)
    try {
      const { created } = await checkM.mutateAsync() as { created: number }
      setResult(created ? `${created} rappel${created > 1 ? 's' : ''} envoyé${created > 1 ? 's' : ''}` : 'Aucun rappel à envoyer aujourd’hui')
    } catch (e) { setResult(e instanceof Error ? e.message : 'Échec de la vérification') }
  }
  return (
    <Card className="p-5 mb-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <h3 className="font-semibold tracking-tight">Prochains rappels</h3>
        <Button variant="ghost" onClick={check} disabled={checkM.isPending}><RefreshCw size={15} />Vérifier maintenant</Button>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        L'application cherche les rappels à envoyer au démarrage puis toutes les 6 heures. Le délai se règle dans Paramètres → Notifications.
      </p>
      {result && <p className="text-sm text-slate-700 mb-2" role="status">{result}</p>}
      {data.length === 0 ? <p className="text-sm text-slate-400">Aucun bail en cours.</p> : (
        <div className="divide-y divide-slate-100 text-sm">
          {data.map(u => (
            <div key={u.leaseId} className="py-2 flex flex-wrap items-center justify-between gap-x-3">
              <span className="min-w-0"><Link to={`/leases/${u.leaseId}`} className="font-medium text-indigo-600 underline">{u.tenantName}</Link>
                <span className="text-slate-400"> · {u.propertyName}</span></span>
              <span className="text-xs text-slate-500">anniversaire le {when(u.anniversary)}{u.daysLeft > 0 && ` (dans ${u.daysLeft} j)`} · <span className={u.status === 'sent' ? 'text-emerald-700' : u.status === 'past' ? 'text-amber-700' : ''}>{statusText(u)}</span></span>
            </div>
          ))}
        </div>
      )}
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
      <Upcoming />
      {isLoading ? <p className="text-sm text-slate-400">Chargement…</p> : data.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-500">
          <BellRing className="mx-auto mb-2 text-slate-300" size={28} />
          Aucune notification. Le délai de prévenance et les canaux (e-mail, téléphone) se règlent dans Paramètres.
        </Card>
      ) : <div className="space-y-3">{data.map(n => <Item key={n.id} n={n} />)}</div>}
    </div>
  )
}
