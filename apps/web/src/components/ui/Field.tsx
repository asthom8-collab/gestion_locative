export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-3.5">
      <span className="block text-xs font-medium text-slate-600 mb-1.5">{label}</span>
      {children}
    </label>
  )
}

/** Style d'un champ sans largeur : à combiner avec une largeur (w-24…), que `w-full` écraserait. */
export const fieldCls = 'px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500'

/** Champ pleine largeur. */
export const inputCls = `w-full ${fieldCls}`
