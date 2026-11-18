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
