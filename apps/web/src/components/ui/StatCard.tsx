import type { LucideIcon } from 'lucide-react'
type Tone = 'green' | 'amber' | 'indigo' | 'slate'
interface StatCardProps {
  Icon: LucideIcon
  label: string
  value: string | number
  tone: Tone
}

export function StatCard({ Icon, label, value, tone }: StatCardProps) {
  const tones: Record<Tone, string> = {
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    slate: 'bg-slate-100 text-slate-500',
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className={`inline-flex p-2 rounded-lg mb-3 ${tones[tone]}`}>
        <Icon size={18} />
      </div>
      <div className="text-2xl font-semibold tracking-tight text-slate-900">{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  )
}
