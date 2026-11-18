import { useProperties } from '../hooks/useProperties'
import { useLeases } from '../hooks/useLeases'
import { StatCard } from '../components/ui/StatCard'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Empty } from '../components/ui/Empty'
import { Building2, CircleCheck, CircleDashed, Euro, CalendarCheck, ChevronRight } from '../components/icons'
import { useNavigate } from 'react-router-dom'

const eur = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

export function Dashboard() {
  const { data: properties = [] } = useProperties()
  const { data: leases = [] } = useLeases()
  const navigate = useNavigate()

  const active = leases.filter(l => l.active)
  const occupied = properties.filter(p => active.some(l => l.propertyId === p.id)).length
  const income = active.reduce((s, l) => s + l.rentAmount + l.chargesAmount, 0)

  return (
    <div>
      <div className="flex items-end justify-between gap-3 mb-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Tableau de bord</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard tone="green" Icon={CircleCheck} value={occupied} label="Bien(s) occupé(s)" />
        <StatCard tone="amber" Icon={CircleDashed} value={properties.length - occupied} label="Bien(s) vacant(s)" />
        <StatCard tone="indigo" Icon={Euro} value={eur(income)} label="Revenus mensuels" />
        <StatCard tone="slate" Icon={CalendarCheck} value={`${active.length}`} label="Bail(s) actif(s)" />
      </div>

      {leases.length === 0 ? (
        <Card>
          <Empty Icon={Building2} title="Bienvenue !"
            hint="Ajoutez un bien, un locataire, puis un bail."
            action={{ label: 'Ajouter un bien', onClick: () => navigate('/properties') }} />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
            <CalendarCheck size={18} className="text-indigo-600" />
            <h3 className="font-semibold tracking-tight">Locations actives</h3>
          </div>
          <div className="divide-y divide-slate-50">
            {active.map(l => (
              <button key={l.id} onClick={() => navigate('/leases')}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors text-left">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-800 truncate">{l.property?.name ?? '—'}</span>
                    <Badge ok={l.active} on="En cours" off="Terminé" />
                  </div>
                  <div className="text-sm text-slate-500 truncate mt-0.5">
                    {l.tenant ? `${l.tenant.firstName} ${l.tenant.lastName}` : '—'} · Depuis le {fmtDate(l.startDate)}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-semibold text-slate-900">{eur(l.rentAmount + l.chargesAmount)}</span>
                  <ChevronRight size={16} className="text-slate-300" />
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
