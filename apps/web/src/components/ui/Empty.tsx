import type { LucideIcon } from 'lucide-react'
import { Button } from './Button'

interface EmptyProps {
  Icon: LucideIcon
  title: string
  hint?: string
  action?: { label: string; onClick: () => void }
}

export function Empty({ Icon, title, hint, action }: EmptyProps) {
  return (
    <div className="text-center py-16 px-6">
      <div className="inline-flex p-4 rounded-2xl bg-slate-100 text-slate-400 mb-4">
        <Icon size={28} />
      </div>
      <p className="font-semibold text-slate-700 tracking-tight">{title}</p>
      {hint && <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">{hint}</p>}
      {action && (
        <div className="mt-5 flex justify-center">
          <Button onClick={action.onClick}>{action.label}</Button>
        </div>
      )}
    </div>
  )
}
