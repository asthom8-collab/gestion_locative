#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# deploy-front.sh — Front Gestion Locative
# À exécuter depuis ~/gestion-locative
# ═══════════════════════════════════════════════════════════════

set -e

WEB="./apps/web"

echo "📁 Création de la structure..."
mkdir -p $WEB/src/{api,types,components/{ui,layout},hooks,pages}

# ─── DÉPENDANCES ──────────────────────────────────────────────
echo "📦 Mise à jour package.json..."
cat > $WEB/package.json << 'EOF'
{
  "name": "gestion-locative-web",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite --port 5175",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.24.0",
    "@tanstack/react-query": "^5.45.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.4",
    "typescript": "^5.4.5",
    "vite": "^5.3.1"
  }
}
EOF
echo "  ✅ package.json"

# ─── CONFIG TAILWIND ──────────────────────────────────────────
cat > $WEB/tailwind.config.js << 'EOF'
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {} },
  plugins: [],
}
EOF

cat > $WEB/postcss.config.js << 'EOF'
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
}
EOF
echo "  ✅ tailwind.config.js / postcss.config.js"

# ─── VITE CONFIG ──────────────────────────────────────────────
cat > $WEB/vite.config.ts << 'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
})
EOF
echo "  ✅ vite.config.ts"

# ─── INDEX HTML ───────────────────────────────────────────────
cat > $WEB/index.html << 'EOF'
<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#0f172a" />
    <link rel="manifest" href="/manifest.json" />
    <title>Gestion Locative</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
EOF
echo "  ✅ index.html"

# ─── CSS GLOBAL ───────────────────────────────────────────────
cat > $WEB/src/index.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  background: #f8fafc;
}
EOF
echo "  ✅ src/index.css"

# ─── TYPES ────────────────────────────────────────────────────
cat > $WEB/src/types/index.ts << 'EOF'
export type PropertyType = 'APARTMENT' | 'HOUSE' | 'PARKING' | 'COMMERCIAL'
export type FiscalRegime = 'NU' | 'PINEL' | 'LMNP_MICRO' | 'LMNP_REEL'
export type LeaseType = 'UNFURNISHED' | 'FURNISHED'

export interface User {
  id: string
  firstName: string
  lastName: string
}

export interface Ownership {
  id: string
  userId: string
  share: number
  user: Pick<User, 'id' | 'firstName' | 'lastName'>
}

export interface Property {
  id: string
  name: string
  address: string
  zipCode: string
  city: string
  type: PropertyType
  surface: number
  fiscalRegime: FiscalRegime
  irlQuarter: number
  createdAt: string
  ownerships: Ownership[]
  leases: Lease[]
}

export interface Tenant {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  iban?: string
  createdAt: string
  leases: Lease[]
}

export interface Lease {
  id: string
  propertyId: string
  tenantId: string
  type: LeaseType
  startDate: string
  endDate?: string
  rentAmount: number
  chargesAmount: number
  rentDayOfMonth: number
  irlReference?: number
  irlQuarter?: number
  irlYear?: number
  active: boolean
  createdAt: string
  property?: Pick<Property, 'id' | 'name' | 'address' | 'city'>
  tenant?: Pick<Tenant, 'id' | 'firstName' | 'lastName' | 'email'>
}

export interface CreatePropertyInput {
  name: string
  address: string
  zipCode: string
  city: string
  type: PropertyType
  surface: number
  fiscalRegime: FiscalRegime
  irlQuarter: number
}

export interface CreateTenantInput {
  firstName: string
  lastName: string
  email: string
  phone?: string
  iban?: string
}

export interface CreateLeaseInput {
  propertyId: string
  tenantId: string
  type: LeaseType
  startDate: string
  rentAmount: number
  chargesAmount: number
  rentDayOfMonth?: number
  irlReference?: number
  irlQuarter?: number
  irlYear?: number
}
EOF
echo "  ✅ src/types/index.ts"

# ─── API CLIENT ───────────────────────────────────────────────
cat > $WEB/src/api/client.ts << 'EOF'
const BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erreur réseau' }))
    throw new Error(err.error ?? 'Erreur inconnue')
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  properties: {
    list: () => request<import('../types').Property[]>('/properties'),
    get: (id: string) => request<import('../types').Property>(`/properties/${id}`),
    create: (data: import('../types').CreatePropertyInput) =>
      request<import('../types').Property>('/properties', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<import('../types').CreatePropertyInput>) =>
      request<import('../types').Property>(`/properties/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/properties/${id}`, { method: 'DELETE' }),
  },
  tenants: {
    list: () => request<import('../types').Tenant[]>('/tenants'),
    get: (id: string) => request<import('../types').Tenant>(`/tenants/${id}`),
    create: (data: import('../types').CreateTenantInput) =>
      request<import('../types').Tenant>('/tenants', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<import('../types').CreateTenantInput>) =>
      request<import('../types').Tenant>(`/tenants/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/tenants/${id}`, { method: 'DELETE' }),
  },
  leases: {
    list: () => request<import('../types').Lease[]>('/leases'),
    get: (id: string) => request<import('../types').Lease>(`/leases/${id}`),
    create: (data: import('../types').CreateLeaseInput) =>
      request<import('../types').Lease>('/leases', { method: 'POST', body: JSON.stringify(data) }),
    terminate: (id: string, endDate: string) =>
      request<import('../types').Lease>(`/leases/${id}/terminate`, {
        method: 'POST',
        body: JSON.stringify({ endDate }),
      }),
  },
}
EOF
echo "  ✅ src/api/client.ts"

# ─── ICÔNES ───────────────────────────────────────────────────
cat > $WEB/src/components/icons.tsx << 'EOF'
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
EOF
echo "  ✅ src/components/icons.tsx"

# ─── COMPOSANTS UI ────────────────────────────────────────────
cat > $WEB/src/components/ui/Card.tsx << 'EOF'
export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}>
      {children}
    </div>
  )
}
EOF

cat > $WEB/src/components/ui/Badge.tsx << 'EOF'
export function Badge({ ok, on, off }: { ok: boolean; on: string; off: string }) {
  return (
    <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full font-medium ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
      {ok ? on : off}
    </span>
  )
}
EOF

cat > $WEB/src/components/ui/Button.tsx << 'EOF'
interface ButtonProps {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'ghost' | 'danger'
  disabled?: boolean
  type?: 'button' | 'submit'
}

export function Button({ children, onClick, variant = 'primary', disabled, type = 'button' }: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors'
  const variants = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm',
    ghost: 'border border-slate-200 text-slate-600 hover:bg-slate-50',
    danger: 'text-rose-600 hover:bg-rose-50',
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`${base} ${variants[variant]} disabled:opacity-50 disabled:cursor-not-allowed`}>
      {children}
    </button>
  )
}
EOF

cat > $WEB/src/components/ui/StatCard.tsx << 'EOF'
type Tone = 'green' | 'amber' | 'indigo' | 'slate'
interface StatCardProps {
  Icon: React.ComponentType<{ size?: number }>
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
EOF

cat > $WEB/src/components/ui/Empty.tsx << 'EOF'
import { Button } from './Button'

interface EmptyProps {
  Icon: React.ComponentType<{ size?: number }>
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
EOF

cat > $WEB/src/components/ui/PageHeader.tsx << 'EOF'
export function PageHeader({ title, subtitle, action }: {
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-end justify-between gap-3 mb-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
EOF

cat > $WEB/src/components/ui/Modal.tsx << 'EOF'
import { X } from '../icons'

interface ModalProps {
  title: string
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
}

export function Modal({ title, onClose, children, wide }: ModalProps) {
  const sizeClass = wide ? 'sm:max-w-2xl max-h-[92vh] overflow-y-auto' : 'sm:max-w-md max-h-[92vh] overflow-y-auto'
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}>
      <div className={`bg-white w-full sm:rounded-2xl rounded-t-2xl shadow-2xl ${sizeClass}`}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h3 className="font-semibold text-slate-900 tracking-tight">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
EOF

cat > $WEB/src/components/ui/Field.tsx << 'EOF'
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-3.5">
      <span className="block text-xs font-medium text-slate-600 mb-1.5">{label}</span>
      {children}
    </label>
  )
}

export const inputCls = 'w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500'
EOF
echo "  ✅ composants UI"

# ─── LAYOUT ───────────────────────────────────────────────────
cat > $WEB/src/components/layout/Sidebar.tsx << 'EOF'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Building2, Users, FileSignature, UserCircle2 } from '../icons'

const NAV = [
  { to: '/', label: 'Tableau de bord', Icon: LayoutDashboard, end: true },
  { to: '/properties', label: 'Biens', Icon: Building2 },
  { to: '/tenants', label: 'Locataires', Icon: Users },
  { to: '/leases', label: 'Locations', Icon: FileSignature },
]

export function Sidebar() {
  return (
    <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:w-64 bg-slate-900 text-slate-300 z-40">
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-slate-800 shrink-0">
        <div className="grid place-items-center w-9 h-9 rounded-lg bg-indigo-600 text-white">
          <Building2 size={18} />
        </div>
        <div>
          <div className="text-white font-semibold tracking-tight leading-none">Gestion Locative</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Espace bailleur</div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ to, label, Icon, end }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${isActive
                ? 'bg-indigo-600 text-white font-medium shadow-sm'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>
      <NavLink to="/settings"
        className="m-3 shrink-0 flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 border-t border-slate-800 pt-3">
        <div className="grid place-items-center w-9 h-9 rounded-full bg-slate-700 text-white shrink-0">
          <UserCircle2 size={15} />
        </div>
        <div className="text-sm text-white truncate">Compte</div>
      </NavLink>
    </aside>
  )
}
EOF

cat > $WEB/src/components/layout/BottomNav.tsx << 'EOF'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Building2, FileSignature, Receipt, MoreHorizontal } from '../icons'

const NAV = [
  { to: '/', label: 'Accueil', Icon: LayoutDashboard, end: true },
  { to: '/properties', label: 'Biens', Icon: Building2 },
  { to: '/leases', label: 'Locations', Icon: FileSignature },
  { to: '/quittances', label: 'Quitt.', Icon: Receipt },
]

export function BottomNav() {
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 grid grid-cols-5">
      {NAV.map(({ to, label, Icon, end }) => (
        <NavLink key={to} to={to} end={end}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 py-2.5 text-[10px] ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}>
          <Icon size={20} />
          <span>{label}</span>
        </NavLink>
      ))}
      <button className="flex flex-col items-center gap-0.5 py-2.5 text-[10px] text-slate-400">
        <MoreHorizontal size={20} />
        <span>Plus</span>
      </button>
    </nav>
  )
}
EOF
echo "  ✅ layout Sidebar + BottomNav"

# ─── HOOKS ────────────────────────────────────────────────────
cat > $WEB/src/hooks/useProperties.ts << 'EOF'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { CreatePropertyInput } from '../types'

export function useProperties() {
  return useQuery({ queryKey: ['properties'], queryFn: api.properties.list })
}

export function useProperty(id: string) {
  return useQuery({ queryKey: ['properties', id], queryFn: () => api.properties.get(id), enabled: !!id })
}

export function useCreateProperty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreatePropertyInput) => api.properties.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties'] }),
  })
}

export function useUpdateProperty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreatePropertyInput> }) => api.properties.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties'] }),
  })
}

export function useDeleteProperty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.properties.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties'] }),
  })
}
EOF

cat > $WEB/src/hooks/useTenants.ts << 'EOF'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { CreateTenantInput } from '../types'

export function useTenants() {
  return useQuery({ queryKey: ['tenants'], queryFn: api.tenants.list })
}

export function useCreateTenant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateTenantInput) => api.tenants.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenants'] }),
  })
}

export function useUpdateTenant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateTenantInput> }) => api.tenants.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenants'] }),
  })
}

export function useDeleteTenant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.tenants.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenants'] }),
  })
}
EOF

cat > $WEB/src/hooks/useLeases.ts << 'EOF'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { CreateLeaseInput } from '../types'

export function useLeases() {
  return useQuery({ queryKey: ['leases'], queryFn: api.leases.list })
}

export function useCreateLease() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateLeaseInput) => api.leases.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leases'] })
      qc.invalidateQueries({ queryKey: ['properties'] })
    },
  })
}

export function useTerminateLease() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, endDate }: { id: string; endDate: string }) => api.leases.terminate(id, endDate),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leases'] })
      qc.invalidateQueries({ queryKey: ['properties'] })
    },
  })
}
EOF
echo "  ✅ hooks"

# ─── PAGES ────────────────────────────────────────────────────
cat > $WEB/src/pages/Dashboard.tsx << 'EOF'
import { useProperties } from '../hooks/useProperties'
import { useLeases } from '../hooks/useLeases'
import { StatCard } from '../components/ui/StatCard'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Empty } from '../components/ui/Empty'
import { Building2, CircleCheck, CircleDashed, Euro, CalendarCheck, ChevronRight } from '../components/icons'
import { useNavigate } from 'react-router-dom'

const eur = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

export function Dashboard() {
  const { data: properties = [] } = useProperties()
  const { data: leases = [] } = useLeases()
  const navigate = useNavigate()

  const active = leases.filter(l => l.active)
  const occupied = properties.filter(p => active.some(l => l.propertyId === p.id)).length
  const income = active.reduce((s, l) => s + l.rentAmount + l.chargesAmount, 0)

  return (
    <div>
      <div className="flex items-end justify-between gap-3 mb-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Tableau de bord</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard tone="green" Icon={CircleCheck} value={occupied} label="Bien(s) occupé(s)" />
        <StatCard tone="amber" Icon={CircleDashed} value={properties.length - occupied} label="Bien(s) vacant(s)" />
        <StatCard tone="indigo" Icon={Euro} value={eur(income)} label="Revenus mensuels" />
        <StatCard tone="slate" Icon={CalendarCheck} value={`${active.length}`} label="Bail(s) actif(s)" />
      </div>

      {leases.length === 0 ? (
        <Card>
          <Empty Icon={Building2} title="Bienvenue !"
            hint="Ajoutez un bien, un locataire, puis un bail."
            action={{ label: 'Ajouter un bien', onClick: () => navigate('/properties') }} />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
            <CalendarCheck size={18} className="text-indigo-600" />
            <h3 className="font-semibold tracking-tight">Locations actives</h3>
          </div>
          <div className="divide-y divide-slate-50">
            {active.map(l => (
              <button key={l.id} onClick={() => navigate('/leases')}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors text-left">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-800 truncate">{l.property?.name ?? '—'}</span>
                    <Badge ok={l.active} on="En cours" off="Terminé" />
                  </div>
                  <div className="text-sm text-slate-500 truncate mt-0.5">
                    {l.tenant ? `${l.tenant.firstName} ${l.tenant.lastName}` : '—'} · Depuis le {fmtDate(l.startDate)}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-semibold text-slate-900">{eur(l.rentAmount + l.chargesAmount)}</span>
                  <ChevronRight size={16} className="text-slate-300" />
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
EOF

cat > $WEB/src/pages/Properties.tsx << 'EOF'
import { useState } from 'react'
import { useProperties, useCreateProperty, useUpdateProperty, useDeleteProperty } from '../hooks/useProperties'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Field, inputCls } from '../components/ui/Field'
import { Empty } from '../components/ui/Empty'
import { Building2, Plus, Pencil, Trash2, MapPin, Check } from '../components/icons'
import type { CreatePropertyInput, Property, PropertyType, FiscalRegime } from '../types'

const TYPES: PropertyType[] = ['APARTMENT', 'HOUSE', 'PARKING', 'COMMERCIAL']
const REGIMES: { value: FiscalRegime; label: string }[] = [
  { value: 'NU', label: 'Location nue' },
  { value: 'PINEL', label: 'Pinel' },
  { value: 'LMNP_MICRO', label: 'LMNP micro-BIC' },
  { value: 'LMNP_REEL', label: 'LMNP réel' },
]
const TYPE_LABELS: Record<PropertyType, string> = { APARTMENT: 'Appartement', HOUSE: 'Maison', PARKING: 'Parking', COMMERCIAL: 'Local commercial' }

const blank: CreatePropertyInput = { name: '', address: '', zipCode: '', city: '', type: 'APARTMENT', surface: 0, fiscalRegime: 'NU', irlQuarter: 2 }

export function Properties() {
  const { data: properties = [], isLoading } = useProperties()
  const { data: leases = [] } = { data: [] as { propertyId: string; active: boolean }[] }
  const createM = useCreateProperty()
  const updateM = useUpdateProperty()
  const deleteM = useDeleteProperty()

  const [modal, setModal] = useState<'create' | Property | null>(null)
  const [form, setForm] = useState<CreatePropertyInput>(blank)

  const openCreate = () => { setForm(blank); setModal('create') }
  const openEdit = (p: Property) => { setForm({ name: p.name, address: p.address, zipCode: p.zipCode, city: p.city, type: p.type, surface: p.surface, fiscalRegime: p.fiscalRegime, irlQuarter: p.irlQuarter }); setModal(p) }

  const save = async () => {
    if (modal === 'create') await createM.mutateAsync(form)
    else if (modal && typeof modal === 'object') await updateM.mutateAsync({ id: modal.id, data: form })
    setModal(null)
  }

  const remove = async (p: Property) => {
    if (!confirm(`Supprimer « ${p.name} » ?`)) return
    await deleteM.mutateAsync(p.id)
  }

  if (isLoading) return <div className="text-slate-400 text-sm py-8 text-center">Chargement…</div>

  return (
    <div>
      <PageHeader title="Mes biens" action={<Button onClick={openCreate}><Plus size={16} />Ajouter</Button>} />
      {properties.length === 0 ? (
        <Card><Empty Icon={Building2} title="Aucun bien" hint="Ajoutez votre premier bien pour commencer." action={{ label: 'Ajouter un bien', onClick: openCreate }} /></Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {properties.map(p => {
            const hasActiveLease = p.leases?.some(l => l.active)
            return (
              <Card key={p.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-900 truncate">{p.name}</span>
                      <Badge ok={hasActiveLease} on="Occupé" off="Vacant" />
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                      <MapPin size={12} />{p.address}, {p.zipCode} {p.city}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {TYPE_LABELS[p.type]} · {p.surface} m²
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><Pencil size={15} /></button>
                    <button onClick={() => remove(p)} className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600"><Trash2 size={15} /></button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {modal && (
        <Modal title={modal === 'create' ? 'Nouveau bien' : 'Modifier le bien'} onClose={() => setModal(null)}>
          <Field label="Nom / désignation">
            <input className={inputCls} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex. T3 rue Lafayette" />
          </Field>
          <Field label="Adresse">
            <input className={inputCls} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code postal">
              <input className={inputCls} value={form.zipCode} onChange={e => setForm({ ...form, zipCode: e.target.value })} maxLength={5} />
            </Field>
            <Field label="Ville">
              <input className={inputCls} value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <select className={inputCls} value={form.type} onChange={e => setForm({ ...form, type: e.target.value as PropertyType })}>
                {TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </select>
            </Field>
            <Field label="Surface (m²)">
              <input className={inputCls} type="number" value={form.surface} onChange={e => setForm({ ...form, surface: Number(e.target.value) })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Régime fiscal">
              <select className={inputCls} value={form.fiscalRegime} onChange={e => setForm({ ...form, fiscalRegime: e.target.value as FiscalRegime })}>
                {REGIMES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </Field>
            <Field label="Trimestre IRL (1-4)">
              <input className={inputCls} type="number" min={1} max={4} value={form.irlQuarter} onChange={e => setForm({ ...form, irlQuarter: Number(e.target.value) })} />
            </Field>
          </div>
          <div className="flex justify-end mt-2">
            <Button onClick={save}><Check size={16} />Enregistrer</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
EOF

cat > $WEB/src/pages/Tenants.tsx << 'EOF'
import { useState } from 'react'
import { useTenants, useCreateTenant, useUpdateTenant, useDeleteTenant } from '../hooks/useTenants'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Field, inputCls } from '../components/ui/Field'
import { Empty } from '../components/ui/Empty'
import { Users, Plus, Pencil, Trash2, Check } from '../components/icons'
import type { CreateTenantInput, Tenant } from '../types'

const blank: CreateTenantInput = { firstName: '', lastName: '', email: '', phone: '' }

const initials = (t: Tenant) => `${t.firstName[0] ?? ''}${t.lastName[0] ?? ''}`.toUpperCase()

export function Tenants() {
  const { data: tenants = [], isLoading } = useTenants()
  const createM = useCreateTenant()
  const updateM = useUpdateTenant()
  const deleteM = useDeleteTenant()

  const [modal, setModal] = useState<'create' | Tenant | null>(null)
  const [form, setForm] = useState<CreateTenantInput>(blank)

  const openCreate = () => { setForm(blank); setModal('create') }
  const openEdit = (t: Tenant) => { setForm({ firstName: t.firstName, lastName: t.lastName, email: t.email, phone: t.phone ?? '' }); setModal(t) }

  const save = async () => {
    if (modal === 'create') await createM.mutateAsync(form)
    else if (modal && typeof modal === 'object') await updateM.mutateAsync({ id: modal.id, data: form })
    setModal(null)
  }

  const remove = async (t: Tenant) => {
    if (t.leases?.some(l => l.active)) return alert('Locataire lié à un bail actif.')
    if (!confirm(`Supprimer ${t.firstName} ${t.lastName} ?`)) return
    await deleteM.mutateAsync(t.id)
  }

  if (isLoading) return <div className="text-slate-400 text-sm py-8 text-center">Chargement…</div>

  return (
    <div>
      <PageHeader title="Mes locataires" action={<Button onClick={openCreate}><Plus size={16} />Ajouter</Button>} />
      {tenants.length === 0 ? (
        <Card><Empty Icon={Users} title="Aucun locataire" hint="Ajoutez un locataire pour l'associer à un bail." action={{ label: 'Ajouter', onClick: openCreate }} /></Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {tenants.map(t => (
            <Card key={t.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid place-items-center w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 text-sm font-semibold shrink-0">
                    {initials(t)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 truncate">{t.firstName} {t.lastName}</div>
                    <div className="text-xs text-slate-500 truncate">{t.email}</div>
                    {t.phone && <div className="text-xs text-slate-400">{t.phone}</div>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><Pencil size={15} /></button>
                  <button onClick={() => remove(t)} className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600"><Trash2 size={15} /></button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {modal && (
        <Modal title={modal === 'create' ? 'Nouveau locataire' : 'Modifier le locataire'} onClose={() => setModal(null)}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prénom"><input className={inputCls} value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} /></Field>
            <Field label="Nom"><input className={inputCls} value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} /></Field>
          </div>
          <Field label="Email"><input className={inputCls} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Téléphone"><input className={inputCls} value={form.phone ?? ''} onChange={e => setForm({ ...form, phone: e.target.value })} /></Field>
          <div className="flex justify-end mt-2"><Button onClick={save}><Check size={16} />Enregistrer</Button></div>
        </Modal>
      )}
    </div>
  )
}
EOF

cat > $WEB/src/pages/Leases.tsx << 'EOF'
import { useState } from 'react'
import { useLeases, useCreateLease, useTerminateLease } from '../hooks/useLeases'
import { useProperties } from '../hooks/useProperties'
import { useTenants } from '../hooks/useTenants'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Field, inputCls } from '../components/ui/Field'
import { Empty } from '../components/ui/Empty'
import { FileSignature, Plus, ChevronRight, Check } from '../components/icons'
import type { CreateLeaseInput, LeaseType } from '../types'

const eur = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

const blank: CreateLeaseInput = { propertyId: '', tenantId: '', type: 'UNFURNISHED', startDate: new Date().toISOString().slice(0, 10), rentAmount: 0, chargesAmount: 0 }

export function Leases() {
  const { data: leases = [], isLoading } = useLeases()
  const { data: properties = [] } = useProperties()
  const { data: tenants = [] } = useTenants()
  const createM = useCreateLease()
  const terminateM = useTerminateLease()

  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<CreateLeaseInput>(blank)

  const save = async () => {
    await createM.mutateAsync({ ...form, startDate: new Date(form.startDate).toISOString() })
    setModal(false)
    setForm(blank)
  }

  const terminate = async (id: string) => {
    const endDate = prompt('Date de fin (YYYY-MM-DD) :')
    if (!endDate) return
    await terminateM.mutateAsync({ id, endDate: new Date(endDate).toISOString() })
  }

  if (isLoading) return <div className="text-slate-400 text-sm py-8 text-center">Chargement…</div>
  if (properties.length === 0 || tenants.length === 0)
    return <Card><Empty Icon={FileSignature} title="Créez d'abord un bien et un locataire" hint="Un bail relie un locataire à un bien." /></Card>

  return (
    <div>
      <PageHeader title="Mes baux" action={<Button onClick={() => { setForm(blank); setModal(true) }}><Plus size={16} />Nouveau bail</Button>} />
      {leases.length === 0 ? (
        <Card><Empty Icon={FileSignature} title="Aucun bail" /></Card>
      ) : (
        <div className="space-y-3">
          {leases.map(l => (
            <Card key={l.id} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900 truncate">{l.property?.name ?? '—'}</span>
                    <Badge ok={l.active} on="En cours" off="Terminé" />
                  </div>
                  <div className="text-sm text-slate-600 mt-0.5">
                    {l.tenant ? `${l.tenant.firstName} ${l.tenant.lastName}` : '—'}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">Depuis le {fmtDate(l.startDate)}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="font-semibold text-slate-900">{eur(l.rentAmount + l.chargesAmount)}</div>
                    {l.chargesAmount > 0 && <div className="text-xs text-slate-400">dont {eur(l.chargesAmount)} ch.</div>}
                  </div>
                  {l.active && (
                    <button onClick={() => terminate(l.id)} className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
                      Résilier
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {modal && (
        <Modal title="Nouveau bail" onClose={() => setModal(false)} wide>
          <Field label="Bien">
            <select className={inputCls} value={form.propertyId} onChange={e => setForm({ ...form, propertyId: e.target.value })}>
              <option value="">— choisir —</option>
              {properties.filter(p => !p.leases?.some(l => l.active)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Locataire">
            <select className={inputCls} value={form.tenantId} onChange={e => setForm({ ...form, tenantId: e.target.value })}>
              <option value="">— choisir —</option>
              {tenants.map(t => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <select className={inputCls} value={form.type} onChange={e => setForm({ ...form, type: e.target.value as LeaseType })}>
                <option value="UNFURNISHED">Location nue</option>
                <option value="FURNISHED">Location meublée</option>
              </select>
            </Field>
            <Field label="Début du bail">
              <input type="date" className={inputCls} value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Loyer hors charges (€)">
              <input type="number" className={inputCls} value={form.rentAmount} onChange={e => setForm({ ...form, rentAmount: Number(e.target.value) })} />
            </Field>
            <Field label="Charges (€)">
              <input type="number" className={inputCls} value={form.chargesAmount} onChange={e => setForm({ ...form, chargesAmount: Number(e.target.value) })} />
            </Field>
          </div>
          <div className="flex justify-end mt-2"><Button onClick={save}><Check size={16} />Créer le bail</Button></div>
        </Modal>
      )}
    </div>
  )
}
EOF
echo "  ✅ pages Dashboard / Properties / Tenants / Leases"

# ─── APP + MAIN ───────────────────────────────────────────────
cat > $WEB/src/App.tsx << 'EOF'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Sidebar } from './components/layout/Sidebar'
import { BottomNav } from './components/layout/BottomNav'
import { Dashboard } from './pages/Dashboard'
import { Properties } from './pages/Properties'
import { Tenants } from './pages/Tenants'
import { Leases } from './pages/Leases'

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } })

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-50 text-slate-900" style={{ fontFamily: "'Segoe UI',system-ui,-apple-system,sans-serif" }}>
          <Sidebar />
          <div className="lg:pl-64">
            <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-28 lg:pb-12">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/properties" element={<Properties />} />
                <Route path="/tenants" element={<Tenants />} />
                <Route path="/leases" element={<Leases />} />
              </Routes>
            </main>
          </div>
          <BottomNav />
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
EOF

cat > $WEB/src/main.tsx << 'EOF'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
EOF
echo "  ✅ App.tsx + main.tsx"

echo ""
echo "════════════════════════════════════════"
echo "✅ Front déployé"
echo "════════════════════════════════════════"
echo ""
echo "Lance maintenant :"
echo "  cd apps/web"
echo "  npm install"
echo "  npm run dev"
echo ""
echo "Accès : http://localhost:5175"
