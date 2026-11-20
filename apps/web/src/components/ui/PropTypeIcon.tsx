import type { LucideIcon } from 'lucide-react'
import { Building2, Home, Warehouse } from '../icons'
import type { PropertyType } from '../../types'

const META: Record<Exclude<PropertyType, 'PARKING'>, { Icon: LucideIcon; color: string }> = {
  APARTMENT: { Icon: Building2, color: 'text-indigo-600 bg-indigo-50' },
  HOUSE: { Icon: Home, color: 'text-emerald-600 bg-emerald-50' },
  COMMERCIAL: { Icon: Warehouse, color: 'text-orange-600 bg-orange-50' },
}

/** Pastille selon le type de bien (comme dans la maquette : un « P » pour un parking). */
export function PropTypeIcon({ type, size = 15 }: { type?: PropertyType; size?: number }) {
  if (type === 'PARKING')
    return <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg shrink-0 text-indigo-600 bg-indigo-50 font-bold text-sm">P</span>
  const { Icon, color } = META[type ?? 'APARTMENT']
  return <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg shrink-0 ${color}`}><Icon size={size} /></span>
}
