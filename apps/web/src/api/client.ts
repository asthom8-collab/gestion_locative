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
    get: (id: string) => request<import('../types').LeaseDetail>(`/leases/${id}`),
    update: (id: string, data: import('../types').UpdateLeaseInput) =>
      request<import('../types').Lease>(`/leases/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    create: (data: import('../types').CreateLeaseInput) =>
      request<import('../types').Lease>('/leases', { method: 'POST', body: JSON.stringify(data) }),
    terminate: (id: string, endDate: string) =>
      request<import('../types').Lease>(`/leases/${id}/terminate`, {
        method: 'POST',
        body: JSON.stringify({ endDate }),
      }),
  },
  rentPayments: {
    list: (year: number, month: number) =>
      request<import('../types').RentPayment[]>(`/rent-payments?year=${year}&month=${month}`),
    /** Toutes les échéances d'un bail, de la plus récente à la plus ancienne */
    listByLease: (leaseId: string) =>
      request<import('../types').RentPayment[]>(`/rent-payments?leaseId=${encodeURIComponent(leaseId)}`),
    generate: (year: number, month: number) =>
      request<{ created: number; payments: import('../types').RentPayment[] }>('/rent-payments/generate', {
        method: 'POST',
        body: JSON.stringify({ year, month }),
      }),
    recordPayment: (id: string, receivedAmount: number, paymentDate: string) =>
      request<import('../types').RentPayment>(`/rent-payments/${id}/payment`, {
        method: 'PUT',
        body: JSON.stringify({ receivedAmount, paymentDate }),
      }),
    cancelPayment: (id: string) =>
      request<import('../types').RentPayment>(`/rent-payments/${id}/payment`, { method: 'DELETE' }),
    delete: (id: string) => request<void>(`/rent-payments/${id}`, { method: 'DELETE' }),
    generateReceipt: (id: string) =>
      request<import('../types').Receipt>(`/rent-payments/${id}/receipt`, { method: 'POST' }),
    /** URL du PDF (ouvert dans un nouvel onglet, ou téléchargé avec download=true) */
    receiptUrl: (id: string, download = false) =>
      `${BASE}/rent-payments/${id}/receipt${download ? '?download' : ''}`,
  },
  me: {
    get: () => request<import('../types').Profile>('/me'),
    update: (data: import('../types').UpdateProfileInput) =>
      request<import('../types').Profile>('/me', { method: 'PATCH', body: JSON.stringify(data) }),
  },
}
