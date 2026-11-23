import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { useProperties } from '../hooks/useProperties'
import { useLeases } from '../hooks/useLeases'
import { useRentPayments } from '../hooks/useRentPayments'
import { useOutdatedRegularizations } from '../hooks/useCharges'
import { PageHeader } from '../components/ui/PageHeader'
import { StatCard } from '../components/ui/StatCard'
import { Card } from '../components/ui/Card'
import { Empty } from '../components/ui/Empty'
import { PaymentStatusBadge } from '../components/ui/PaymentStatusBadge'
import { PropTypeIcon } from '../components/ui/PropTypeIcon'
import {
  Building2, CircleCheck, CircleDashed, Euro, CalendarCheck, AlertCircle, Receipt, Wallet,
} from '../components/icons'
import type { Lease, OutdatedRegularization, RentPayment } from '../types'

const eur = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
const fmtDate = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
const DAY = 86_400_000

type Ym = { year: number; month: number }
const ymKey = ({ year, month }: Ym) => `${year}-${month}`
const ymLabel = ({ year, month }: Ym) => {
  const s = new Date(year, month - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Les 6 derniers mois, plus le suivant à partir du 25 (comme dans la maquette), le plus récent en premier. */
function selectableMonths(now: Date): Ym[] {
  const from = now.getDate() >= 25 ? -1 : 0
  return Array.from({ length: 6 - from }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (i + from), 1)
    return { year: d.getFullYear(), month: d.getMonth() + 1 }
  })
}

interface Alert {
  level: 'amber' | 'rose' | 'indigo'
  Icon: LucideIcon
  title: string
  body: string
  action: { label: string; to: string }
}

const ALERT_COLORS = { amber: 'border-amber-200 bg-amber-50', rose: 'border-rose-200 bg-rose-50', indigo: 'border-indigo-100 bg-indigo-50' }
const ALERT_ICON_COLORS = { amber: 'text-amber-500', rose: 'text-rose-500', indigo: 'text-indigo-500' }

const tenantName = (l: Pick<Lease, 'tenant'>) => (l.tenant ? `${l.tenant.firstName} ${l.tenant.lastName}` : '—')
const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`

/** Un bail donne lieu à une échéance pour le mois s'il en couvre au moins un jour : même règle que
 *  `findLeasesCovering` côté API (bail commencé avant la fin du mois, et soit sans date de fin et actif,
 *  soit avec une date de fin dans le mois ou après). Les dates sont en UTC, comme dans l'API. */
export function coversMonth(l: Pick<Lease, 'startDate' | 'endDate' | 'active'>, { year, month }: Ym) {
  const start = Date.UTC(year, month - 1, 1)
  const end = Date.UTC(year, month, 1) - 1
  if (new Date(l.startDate).getTime() > end) return false
  return l.endDate ? new Date(l.endDate).getTime() >= start : l.active
}

export function buildAlerts(leases: Lease[], current: RentPayment[], now: Date, cur: Ym, outdated: OutdatedRegularization[] = []): Alert[] {
  const active = leases.filter(l => l.active)
  const alerts: Alert[] = []
  const rentsLink = `/rents?year=${cur.year}&month=${cur.month}`

  // Loyers du mois en retard ou payés en partie
  const late = current.filter(p => p.status === 'LATE' || p.status === 'PARTIAL')
  if (late.length > 0)
    alerts.push({
      level: 'rose', Icon: AlertCircle, title: `${plural(late.length, 'loyer')} en retard ce mois-ci`,
      body: late.map(p => `${p.lease.property.name} (${tenantName(p.lease)})`).join(' · '),
      action: { label: 'Voir les loyers', to: rentsLink },
    })

  // Échéances du mois pas encore générées (même règle que l'API, voir coversMonth)
  const due = leases.filter(l => coversMonth(l, cur) && !current.some(p => p.leaseId === l.id))
  if (due.length > 0)
    alerts.push({
      level: 'amber', Icon: Receipt, title: `Échéances de ${ymLabel(cur).toLowerCase()} à générer`,
      body: `${due.length} ${due.length > 1 ? 'baux' : 'bail'} sans échéance pour ce mois.`,
      action: { label: 'Générer le mois', to: rentsLink },
    })

  // Régularisations enregistrées devenues fausses : charges ou provisions modifiées après coup
  for (const r of outdated)
    alerts.push({
      level: 'amber', Icon: Wallet, title: `Régularisation ${r.year} à refaire — ${r.propertyName}`,
      body: `${r.tenantName} · Les charges ou les provisions ont changé depuis l'enregistrement : solde enregistré ${eur(r.balance)}`
        + (r.currentBalance != null ? `, recalculé ${eur(r.currentBalance)}.` : ', le bail ne couvre plus cette année.'),
      action: { label: 'Voir le bail', to: `/leases/${r.leaseId}` },
    })

  for (const l of active) {
    // Bail arrivant à échéance (< 90 jours)
    if (l.endDate) {
      const end = new Date(l.endDate)
      const days = Math.round((end.getTime() - now.getTime()) / DAY)
      if (days >= 0 && days <= 90)
        alerts.push({
          level: days <= 30 ? 'rose' : 'amber', Icon: CalendarCheck,
          title: `Bail expirant dans ${plural(days, 'jour')}`,
          body: `${l.property?.name ?? '?'} — ${tenantName(l)} · Échéance le ${fmtDate(end)}`,
          action: { label: 'Voir le bail', to: `/leases/${l.id}` },
        })
    }
    // Révision annuelle du loyer, à la date anniversaire du bail (< 90 jours)
    const start = new Date(l.startDate)
    let next = new Date(now.getFullYear(), start.getMonth(), start.getDate())
    if (next <= now) next = new Date(now.getFullYear() + 1, start.getMonth(), start.getDate())
    const days = Math.round((next.getTime() - now.getTime()) / DAY)
    // Déjà révisé pour cette échéance (révision appliquée depuis l'anniversaire précédent)
    const lastRevision = l.rentRevisions?.[0] ? new Date(l.rentRevisions[0].effectiveDate) : null
    const previous = new Date(next.getFullYear() - 1, next.getMonth(), next.getDate())
    if (days <= 90 && !(lastRevision && lastRevision > previous))
      alerts.push({
        level: days <= 30 ? 'rose' : 'indigo', Icon: Euro,
        title: `Révision du loyer — ${l.property?.name ?? '?'}`,
        body: `${tenantName(l)} · Loyer actuel : ${eur(l.rentAmount)} HC. Date anniversaire le ${fmtDate(next)} (dans ${plural(days, 'jour')}).`,
        action: { label: 'Réviser le loyer', to: `/leases/${l.id}` },
      })
  }
  return alerts
}

export function Dashboard() {
  const navigate = useNavigate()
  const now = new Date()
  const cur: Ym = { year: now.getFullYear(), month: now.getMonth() + 1 }
  const [selected, setSelected] = useState<Ym>(cur)

  const { data: properties = [] } = useProperties()
  const { data: leases = [] } = useLeases()
  const { data: current = [] } = useRentPayments(cur.year, cur.month)
  const { data: rows = [], isLoading } = useRentPayments(selected.year, selected.month)
  const { data: outdated = [] } = useOutdatedRegularizations()

  const active = leases.filter(l => l.active)
  const occupied = properties.filter(p => active.some(l => l.propertyId === p.id)).length
  const income = active.reduce((s, l) => s + l.rentAmount + l.chargesAmount, 0)
  const paid = current.filter(p => p.status === 'RECEIVED').length
  const alerts = buildAlerts(leases, current, now, cur, outdated)
  const propType = (id: string) => properties.find(p => p.id === id)?.type
  const months = selectableMonths(now)

  return (
    <div>
      <PageHeader title="Tableau de bord"
        subtitle={now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard tone="green" Icon={CircleCheck} value={occupied} label="Bien(s) occupé(s)" />
        <StatCard tone="amber" Icon={CircleDashed} value={properties.length - occupied} label="Bien(s) vacant(s)" />
        <StatCard tone="indigo" Icon={Euro} value={eur(income)} label="Revenus mensuels" />
        <StatCard tone="slate" Icon={CalendarCheck} value={`${paid}/${current.length}`} label="Loyers reçus ce mois" />
      </div>

      {alerts.length > 0 && (
        <div className="mb-6 space-y-3">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-2">
            <AlertCircle size={15} />Alertes et rappels
          </h3>
          {alerts.map((a, i) => (
            <div key={i} role="note" className={`flex items-start gap-3 p-4 rounded-xl border ${ALERT_COLORS[a.level]}`}>
              <a.Icon size={18} className={`shrink-0 mt-0.5 ${ALERT_ICON_COLORS[a.level]}`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-800">{a.title}</div>
                <div className="text-xs text-slate-600 mt-0.5">{a.body}</div>
              </div>
              <button onClick={() => navigate(a.action.to)}
                className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 whitespace-nowrap">
                {a.action.label}
              </button>
            </div>
          ))}
        </div>
      )}

      {properties.length === 0 ? (
        <Card>
          <Empty Icon={Building2} title="Bienvenue !" hint="Ajoutez un bien, un locataire, puis un bail."
            action={{ label: 'Ajouter un bien', onClick: () => navigate('/properties') }} />
        </Card>
      ) : active.length === 0 ? (
        <Card><Empty Icon={CalendarCheck} title="Aucun bail actif" hint="Créez un bail pour suivre les paiements."
          action={{ label: 'Créer un bail', onClick: () => navigate('/leases') }} /></Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
            <CalendarCheck size={18} className="text-indigo-600" />
            <h3 className="font-semibold tracking-tight">Suivi mensuel</h3>
            <select aria-label="Mois"
              className="ml-auto text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={ymKey(selected)}
              onChange={e => setSelected(months.find(m => ymKey(m) === e.target.value)!)}>
              {months.map(m => (
                <option key={ymKey(m)} value={ymKey(m)}>{ymLabel(m)}{ymKey(m) === ymKey(cur) ? ' (en cours)' : ''}</option>
              ))}
            </select>
          </div>
          {isLoading ? (
            <p className="px-5 py-6 text-sm text-slate-400">Chargement…</p>
          ) : rows.length === 0 ? (
            <Empty Icon={Receipt} title="Aucune échéance pour ce mois"
              hint="Les échéances se génèrent depuis la page Loyers."
              action={{ label: 'Aller aux loyers', onClick: () => navigate(`/rents?year=${selected.year}&month=${selected.month}`) }} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-xs text-slate-500 font-medium uppercase tracking-wide">
                    <th className="text-left px-5 py-3">Bien</th>
                    <th className="text-left px-3 py-3">Locataire</th>
                    <th className="text-left px-3 py-3">Date de paiement</th>
                    <th className="text-center px-3 py-3">Loyer</th>
                    <th className="text-center px-3 py-3">Quittance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map(p => (
                    <tr key={p.id} onClick={() => navigate(`/rents?year=${selected.year}&month=${selected.month}`)}
                      className="cursor-pointer transition-colors hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <PropTypeIcon type={propType(p.lease.property.id)} size={13} />
                          <span className="truncate text-slate-700 max-w-[160px]">{p.lease.property.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-600 truncate max-w-[140px]">{tenantName(p.lease)}</td>
                      <td className="px-3 py-3 text-slate-500 whitespace-nowrap text-xs">
                        {p.paymentDate ? new Date(p.paymentDate).toLocaleDateString('fr-FR') : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-3 text-center"><PaymentStatusBadge status={p.status} /></td>
                      <td className="px-3 py-3 text-center">
                        {p.receipt
                          ? <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700"><CircleCheck size={11} />Établie</span>
                          : <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-500"><Receipt size={11} />À établir</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
