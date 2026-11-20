import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Building2, FileSignature, Receipt, Settings } from '../icons'

const NAV = [
  { to: '/', label: 'Accueil', Icon: LayoutDashboard, end: true },
  { to: '/properties', label: 'Biens', Icon: Building2 },
  { to: '/leases', label: 'Locations', Icon: FileSignature },
  { to: '/rents', label: 'Loyers', Icon: Receipt },
  { to: '/settings', label: 'Réglages', Icon: Settings },
]

export function BottomNav() {
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 grid grid-cols-5">
      {NAV.map(({ to, label, Icon, end }) => (
        <NavLink key={to} to={to} end={end}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 py-2.5 text-[10px] ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}>
          <Icon size={20} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
