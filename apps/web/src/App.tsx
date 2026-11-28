import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryCache, MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { isUnauthorized } from './api/client'
import { AuthGate } from './components/auth/AuthGate'
import { Sidebar } from './components/layout/Sidebar'
import { BottomNav } from './components/layout/BottomNav'
import { MobileHeader } from './components/layout/MobileHeader'
import { Dashboard } from './pages/Dashboard'
import { Properties } from './pages/Properties'
import { Tenants } from './pages/Tenants'
import { Leases } from './pages/Leases'
import { LeaseDetail } from './pages/LeaseDetail'
import { Rents } from './pages/Rents'
import { Payments } from './pages/Payments'
import { Bank } from './pages/Bank'
import { Documents } from './pages/Documents'
import { Charges } from './pages/Charges'
import { Interventions } from './pages/Interventions'
import { Owners } from './pages/Owners'
import { Indices } from './pages/Indices'
import { TaxRules } from './pages/TaxRules'
import { Notifications } from './pages/Notifications'
import { Settings } from './pages/Settings'

export function createQueryClient() {
  // Session expirée pendant l'utilisation : on recharge le profil, ce qui ramène à l'écran de connexion.
  // Pas pour la requête du profil elle-même (sa 401 relancerait le profil, en boucle).
  const onError = (error: unknown) => {
    if (isUnauthorized(error)) qc.invalidateQueries({ queryKey: ['me'] })
  }
  const qc: QueryClient = new QueryClient({
    defaultOptions: { queries: { retry: (count, error) => !isUnauthorized(error) && count < 1, staleTime: 30_000 } },
    queryCache: new QueryCache({ onError: (error, query) => { if (query.queryKey[0] !== 'me') onError(error) } }),
    mutationCache: new MutationCache({ onError }),
  })
  return qc
}

export default function App() {
  const [qc] = useState(createQueryClient)
  return (
    <QueryClientProvider client={qc}>
      <AuthGate>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-50 text-slate-900" style={{ fontFamily: "'Segoe UI',system-ui,-apple-system,sans-serif" }}>
          <Sidebar />
          <MobileHeader />
          <div className="lg:pl-64">
            <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-28 lg:pb-12">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/properties" element={<Properties />} />
                <Route path="/owners" element={<Owners />} />
                <Route path="/tenants" element={<Tenants />} />
                <Route path="/leases" element={<Leases />} />
                <Route path="/leases/:id" element={<LeaseDetail />} />
                <Route path="/rents" element={<Rents />} />
                <Route path="/payments" element={<Payments />} />
                <Route path="/bank" element={<Bank />} />
                <Route path="/documents" element={<Documents />} />
                <Route path="/charges" element={<Charges />} />
                <Route path="/interventions" element={<Interventions />} />
                <Route path="/indices" element={<Indices />} />
                <Route path="/tax-rules" element={<TaxRules />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </main>
          </div>
          <BottomNav />
        </div>
      </BrowserRouter>
      </AuthGate>
    </QueryClientProvider>
  )
}
