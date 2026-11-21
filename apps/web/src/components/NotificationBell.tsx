import { Link } from 'react-router-dom'
import { Bell } from './icons'
import { useNotifications } from '../hooks/useNotifications'

/** Cloche vers la page Notifications, avec le nombre de notifications non lues. */
export function NotificationBell({ className = '' }: { className?: string }) {
  const { data = [] } = useNotifications()
  const unread = data.filter(n => !n.readAt).length
  return (
    <Link to="/notifications" aria-label={unread ? `Notifications (${unread} non lues)` : 'Notifications'} title="Notifications"
      className={`relative p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white ${className}`}>
      <Bell size={18} />
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-rose-500 text-white text-[10px] font-semibold">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  )
}
