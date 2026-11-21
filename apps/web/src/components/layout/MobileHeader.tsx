import { Building2 } from '../icons'
import { NotificationBell } from '../NotificationBell'

export function MobileHeader() {
  return (
    <header className="lg:hidden sticky top-0 z-30 bg-slate-900 text-white flex items-center gap-2.5 px-4 h-14">
      <div className="grid place-items-center w-8 h-8 rounded-lg bg-indigo-600"><Building2 size={16} /></div>
      <span className="font-semibold tracking-tight">Gestion Locative</span>
      <NotificationBell className="ml-auto -mr-2" />
    </header>
  )
}
