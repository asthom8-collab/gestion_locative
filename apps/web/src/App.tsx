import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Sidebar } from './components/layout/Sidebar'
import { BottomNav } from './components/layout/BottomNav'
import { MobileHeader } from './components/layout/MobileHeader'
import { Dashboard } from './pages/Dashboard'
import { Properties } from './pages/Properties'
import { Tenants } from './pages/Tenants'
import { Leases } from './pages/Leases'
import { LeaseDetail } from './pages/LeaseDetail'
import { Rents } from './pages/Rents'
import { Settings } from './pages/Settings'

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } })

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-50 text-slate-900" style={{ fontFamily: "'Segoe UI',system-ui,-apple-system,sans-serif" }}>
          <Sidebar />
          <MobileHeader />
          <div className="lg:pl-64">
            <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-28 lg:pb-12">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/properties" element={<Properties />} />
                <Route path="/tenants" element={<Tenants />} />
                <Route path="/leases" element={<Leases />} />
                <Route path="/leases/:id" element={<LeaseDetail />} />
                <Route path="/rents" element={<Rents />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </main>
          </div>
          <BottomNav />
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
