type IconProps = { size?: number; className?: string }

const mk = (paths: React.ReactNode) =>
  ({ size = 18, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" className={className}>
      {paths}
    </svg>
  )

export const LayoutDashboard = mk(<><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>)
export const Building2 = mk(<><rect x="4" y="2" width="16" height="20" rx="1" /><path d="M9 22v-4h6v4" /><path d="M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" /></>)
export const Users = mk(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>)
export const FileSignature = mk(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h6" /></>)
export const Receipt = mk(<><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" /><path d="M8 7h8M8 11h8M8 15h5" /></>)
export const Plus = mk(<path d="M12 5v14M5 12h14" />)
export const Pencil = mk(<><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></>)
export const Trash2 = mk(<><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" /></>)
export const X = mk(<path d="M18 6 6 18M6 6l12 12" />)
export const Check = mk(<path d="M20 6 9 17l-5-5" />)
export const ChevronRight = mk(<path d="M9 18l6-6-6-6" />)
export const MapPin = mk(<><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>)
export const Euro = mk(<><path d="M4 10h12M4 14h9" /><path d="M19 6a7.5 7.5 0 1 0 0 12" /></>)
export const CircleCheck = mk(<><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></>)
export const CircleDashed = mk(<><path d="M10.1 2.18a10 10 0 0 1 3.8 0" /><path d="M5.93 4.3a10 10 0 0 0-2.69 2.7" /><path d="M2.18 10.1a10 10 0 0 0 0 3.8" /><path d="M3.24 17a10 10 0 0 0 2.69 2.7" /><path d="M10.1 21.82a10 10 0 0 0 3.8 0" /><path d="M17 20.66a10 10 0 0 0 2.7-2.69" /><path d="M21.82 13.9a10 10 0 0 0 0-3.8" /><path d="M20.76 7a10 10 0 0 0-2.69-2.7" /></>)
export const MoreHorizontal = mk(<><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></>)
export const UserCircle2 = mk(<><path d="M18 20a6 6 0 0 0-12 0" /><circle cx="12" cy="10" r="4" /><circle cx="12" cy="12" r="10" /></>)
export const CalendarCheck = mk(<><path d="M8 2v4M16 2v4" /><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 10h18" /><path d="m9 16 2 2 4-4" /></>)
export const AlertCircle = mk(<><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></>)
export const Home = mk(<><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>)
export const Car = mk(<><path d="M19 17H5v-4l2-5h10l2 5v4z" /><circle cx="7.5" cy="17.5" r="1.5" /><circle cx="16.5" cy="17.5" r="1.5" /></>)
