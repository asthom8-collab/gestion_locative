import { NavLink } from 'react-router-dom'
import { Building2, UserCircle2 } from '../icons'
import { useMe } from '../../hooks/useMe'
import { NAV_GROUPS, initials } from './nav'

export function Sidebar() {
  const { data: me } = useMe()
  const name = me ? `${me.firstName} ${me.lastName}`.trim() : ''
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
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi}>
            {group.label && (
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 mb-1">{group.label}</p>
            )}
            <div className="space-y-0.5">
              {group.items.map(({ to, label, Icon, end }) => (
                <NavLink key={to} to={to} end={end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${isActive
                      ? 'bg-indigo-600 text-white font-medium shadow-sm'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                  <Icon size={16} />
                  {label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <NavLink to="/settings"
        className="m-3 shrink-0 flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 border-t border-slate-800 pt-3">
        <div className="grid place-items-center w-9 h-9 rounded-full bg-slate-700 text-white text-xs font-semibold shrink-0">
          {initials(me?.firstName, me?.lastName) || <UserCircle2 size={15} />}
        </div>
        <div className="min-w-0">
          <div className="text-sm text-white truncate">{name || 'Compte / Profil'}</div>
          <div className="text-[11px] text-slate-500">Paramètres</div>
        </div>
      </NavLink>
    </aside>
  )
}
