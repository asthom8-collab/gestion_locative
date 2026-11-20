import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Building2, Users, FileSignature, Receipt, UserCircle2 } from '../icons'

const NAV = [
  { to: '/', label: 'Tableau de bord', Icon: LayoutDashboard, end: true },
  { to: '/properties', label: 'Biens', Icon: Building2 },
  { to: '/tenants', label: 'Locataires', Icon: Users },
  { to: '/leases', label: 'Locations', Icon: FileSignature },
  { to: '/rents', label: 'Loyers', Icon: Receipt },
]

export function Sidebar() {
  return (
    <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:w-64 bg-slate-900 text-slate-300 z-40">
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-slate-800 shrink-0">
        <div className="grid place-items-center w-9 h-9 rounded-lg bg-indigo-600 text-white">
          <Building2 size={18} />
        </div>
        <div>
          <div className="text-white font-semibold tracking-tight leading-none">Gestion Locative</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Espace bailleur</div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ to, label, Icon, end }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${isActive
                ? 'bg-indigo-600 text-white font-medium shadow-sm'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>
      <NavLink to="/settings"
        className="m-3 shrink-0 flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 border-t border-slate-800 pt-3">
        <div className="grid place-items-center w-9 h-9 rounded-full bg-slate-700 text-white shrink-0">
          <UserCircle2 size={15} />
        </div>
        <div className="text-sm text-white truncate">Paramètres</div>
      </NavLink>
    </aside>
  )
}
