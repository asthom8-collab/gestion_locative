import { AlertCircle, X } from '../icons'

export function ErrorAlert({ message, onClose }: { message: string | null; onClose?: () => void }) {
  if (!message) return null
  return (
    <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      <AlertCircle size={16} className="shrink-0 mt-0.5" />
      <span className="flex-1">{message}</span>
      {onClose && (
        <button onClick={onClose} aria-label="Fermer" className="shrink-0 text-rose-400 hover:text-rose-600"><X size={16} /></button>
      )}
    </div>
  )
}
