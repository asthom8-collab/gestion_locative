import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { CircleCheck, MoreHorizontal } from '../icons'
import { PRIMARY_NAV, SECONDARY_NAV } from './nav'

/** Barre du bas sur mobile, avec un menu « Plus » qui s'ouvre par le bas (comme dans la maquette). */
export function BottomNav() {
  const [showMore, setShowMore] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => setShowMore(false), [pathname])
  const inSecondary = SECONDARY_NAV.some(n => pathname.startsWith(n.to))

  return (
    <>
      {showMore && (
        <div className="lg:hidden fixed inset-0 z-40" onClick={() => setShowMore(false)}>
          <div className="absolute inset-0 bg-slate-900/40" />
          <div role="dialog" aria-label="Menu"
            className="absolute bottom-16 left-0 right-0 bg-white rounded-t-2xl shadow-2xl px-4 pt-4 pb-6"
            onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-4" />
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide px-1 mb-2">Menu</p>
            {SECONDARY_NAV.map(({ to, label, Icon }) => (
              <NavLink key={to} to={to}
                className={({ isActive }) =>
                  `w-full flex items-center gap-3 px-3 py-3.5 rounded-xl transition-colors mb-1 ${isActive ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'}`}>
                {({ isActive }) => (
                  <>
                    <span className={`p-2 rounded-lg ${isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                      <Icon size={20} />
                    </span>
                    <span className="font-medium text-sm">{label}</span>
                    {isActive && <CircleCheck size={16} className="ml-auto text-indigo-500" />}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      )}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 grid grid-cols-5">
        {PRIMARY_NAV.map(({ to, label, short, Icon, end }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2.5 text-[10px] ${isActive && !showMore ? 'text-indigo-600' : 'text-slate-400'}`}>
            <Icon size={20} />
            <span className="truncate max-w-full px-0.5">{short ?? label}</span>
          </NavLink>
        ))}
        <button type="button" onClick={() => setShowMore(v => !v)}
          className={`flex flex-col items-center gap-0.5 py-2.5 text-[10px] ${showMore || inSecondary ? 'text-indigo-600' : 'text-slate-400'}`}>
          <MoreHorizontal size={20} />
          <span>Plus</span>
        </button>
      </nav>
    </>
  )
}
