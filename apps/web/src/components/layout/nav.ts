import type { LucideIcon } from 'lucide-react'
import { LayoutDashboard, Building2, Users, FileSignature, Receipt, UserCircle2, Wallet, KeyRound } from '../icons'

export interface NavItem { to: string; label: string; short?: string; Icon: LucideIcon; end?: boolean }

/** Menu de la barre latérale, groupé comme dans la maquette. Les écrans des phases suivantes
 *  (Paiements, Synchro bancaire, Impôts, Interventions, Documents, États des lieux) y seront ajoutés au fil de l'eau. */
export const NAV_GROUPS: { label?: string; items: NavItem[] }[] = [
  { items: [{ to: '/', label: 'Tableau de bord', short: 'Accueil', Icon: LayoutDashboard, end: true }] },
  {
    label: 'Patrimoine',
    items: [
      { to: '/properties', label: 'Biens', Icon: Building2 },
      { to: '/owners', label: 'Propriétaires', Icon: KeyRound },
      { to: '/tenants', label: 'Locataires', Icon: Users },
      { to: '/leases', label: 'Locations', Icon: FileSignature },
    ],
  },
  {
    label: 'Finances',
    items: [
      { to: '/rents', label: 'Loyers et quittances', short: 'Loyers', Icon: Receipt },
      { to: '/charges', label: 'Charges', Icon: Wallet },
    ],
  },
]

const ALL = NAV_GROUPS.flatMap(g => g.items)
const pick = (to: string) => ALL.find(i => i.to === to)!

/** Barre du bas sur mobile : 4 entrées, puis « Plus » pour le reste. */
export const PRIMARY_NAV: NavItem[] = ['/', '/properties', '/leases', '/rents'].map(pick)
export const SECONDARY_NAV: NavItem[] = [
  ...ALL.filter(i => !PRIMARY_NAV.includes(i)),
  { to: '/settings', label: 'Compte / Profil', Icon: UserCircle2 },
]

export const initials = (first?: string, last?: string) =>
  `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase()
