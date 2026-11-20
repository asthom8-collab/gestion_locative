import type { ReactNode } from 'react'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

/** Remplace fetch : chaque chemin d'API (ex. "/api/properties") renvoie le corps JSON associé. */
export function mockApi(routes: Record<string, unknown>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const path = typeof input === 'string' ? input : input.toString()
    if (!(path in routes)) return new Response(JSON.stringify({ error: `Route non simulée : ${path}` }), { status: 404 })
    return new Response(JSON.stringify(routes[path]), { status: 200, headers: { 'Content-Type': 'application/json' } })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

export function renderWithProviders(ui: ReactNode, route = '/') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

export const property = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  name: 'T3 Lyon 3e',
  address: '12 rue de la République',
  zipCode: '69003',
  city: 'Lyon',
  type: 'APARTMENT',
  surface: 65,
  fiscalRegime: 'NU',
  irlQuarter: 2,
  leases: [],
  ...over,
})

export const lease = (over: Record<string, unknown> = {}) => ({
  id: 'l1',
  propertyId: 'p1',
  tenantId: 't1',
  type: 'UNFURNISHED',
  startDate: '2025-01-01T00:00:00.000Z',
  endDate: null,
  rentAmount: 800,
  chargesAmount: 50,
  rentDayOfMonth: 1,
  active: true,
  property: { id: 'p1', name: 'T3 Lyon 3e', address: '12 rue de la République', city: 'Lyon' },
  tenant: { id: 't1', firstName: 'Jean', lastName: 'Dupont', email: 'jean@example.com' },
  ...over,
})
