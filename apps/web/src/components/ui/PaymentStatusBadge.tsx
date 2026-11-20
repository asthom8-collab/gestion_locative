import type { PaymentStatus } from '../../types'

const STATUS: Record<PaymentStatus, { label: string; cls: string }> = {
  RECEIVED: { label: 'Payé', cls: 'bg-emerald-50 text-emerald-700' },
  PARTIAL: { label: 'Partiel', cls: 'bg-amber-50 text-amber-700' },
  LATE: { label: 'En retard', cls: 'bg-rose-50 text-rose-700' },
  PENDING: { label: 'À venir', cls: 'bg-slate-100 text-slate-600' },
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const s = STATUS[status]
  return <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>
}
