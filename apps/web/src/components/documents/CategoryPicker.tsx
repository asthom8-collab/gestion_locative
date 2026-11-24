import { DOCUMENT_CATEGORIES } from '../../lib/documents'
import type { DocumentCategory } from '../../types'

/** Choix du type de document par boutons (plus pratique qu'une liste déroulante sur téléphone). */
export function CategoryPicker({ value, onChange, order }: {
  value: DocumentCategory
  onChange: (c: DocumentCategory) => void
  order?: DocumentCategory[]
}) {
  const categories = order ?? (Object.keys(DOCUMENT_CATEGORIES) as DocumentCategory[])
  return (
    <div role="radiogroup" aria-label="Type de document" className="mb-3.5">
      <span className="block text-xs font-medium text-slate-600 mb-1.5">Type de document</span>
      <div className="flex flex-wrap gap-2">
        {categories.map(c => (
          <button key={c} type="button" role="radio" aria-checked={value === c} onClick={() => onChange(c)}
            className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${value === c
              ? 'bg-indigo-600 border-indigo-600 text-white'
              : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {DOCUMENT_CATEGORIES[c]}
          </button>
        ))}
      </div>
    </div>
  )
}
