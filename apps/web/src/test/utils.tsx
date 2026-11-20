import type { ReactNode } from 'react'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

/** Réponse simulée avec un code HTTP précis (ex. reply(409, { error: '…' })). */
export const reply = (status: number, body?: unknown) => ({ __reply: true as const, status, body })

/**
 * Remplace fetch. Les clés sont un chemin d'API (« /api/properties », toutes méthodes) ou
 * « MÉTHODE chemin » (« DELETE /api/properties/p1 »), prioritaire. La valeur est le corps JSON
 * renvoyé avec un 200, ou reply(status, corps).
 */
export function mockApi(routes: Record<string, unknown>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = typeof input === 'string' ? input : input.toString()
    const method = (init?.method ?? 'GET').toUpperCase()
    const key = `${method} ${path}` in routes ? `${method} ${path}` : path
    if (!(key in routes)) return new Response(JSON.stringify({ error: `Route non simulée : ${method} ${path}` }), { status: 404 })
    const value = routes[key] as { __reply?: true; status: number; body?: unknown }
    const [status, body] = value && value.__reply ? [value.status, value.body] : [200, value]
    if (status === 204) return new Response(null, { status })
    return new Response(JSON.stringify(body ?? null), { status, headers: { 'Content-Type': 'application/json' } })
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
