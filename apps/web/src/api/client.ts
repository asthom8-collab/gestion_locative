import type * as T from '../types'

const BASE = '/api'

/** Erreur renvoyée par l'API, avec son code HTTP (401 = non connecté, 403 = interdit…). */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export const isUnauthorized = (e: unknown) => e instanceof ApiError && e.status === 401

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  // Le cookie de session part avec la requête (même origine, via le proxy /api)
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erreur réseau' }))
    throw new ApiError(res.status, err?.error ?? 'Erreur inconnue')
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

const query = (params: Record<string, string | undefined>) => {
  const q = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1])).toString()
  return q ? `?${q}` : ''
}

export const api = {
  bank: {
    accounts: () => request<T.BankAccount[]>('/bank-accounts'),
    createAccount: (name: string) => request<T.BankAccount>('/bank-accounts', { method: 'POST', body: JSON.stringify({ name }) }),
    renameAccount: (id: string, name: string) =>
      request<T.BankAccount>(`/bank-accounts/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
    deleteAccount: (id: string) => request<void>(`/bank-accounts/${id}`, { method: 'DELETE' }),
    /** Le relevé CSV part brut dans le corps */
    importCsv: (accountId: string, file: File) =>
      request<T.BankImportResult>(`/bank-accounts/${accountId}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv' },
        body: file,
      }),
    banks: () => request<T.BankConnectionBanks>('/bank-connection/banks'),
    connect: (accountId: string, bankName: string) =>
      request<{ url: string }>(`/bank-accounts/${accountId}/connect`, { method: 'POST', body: JSON.stringify({ bankName }) }),
    completeConnection: (accountId: string, returnUrl: string) =>
      request<T.BankAccount>(`/bank-accounts/${accountId}/connect/complete`, { method: 'POST', body: JSON.stringify({ returnUrl }) }),
    chooseRemoteAccount: (accountId: string, uid: string) =>
      request<T.BankAccount>(`/bank-accounts/${accountId}/connect/account`, { method: 'PUT', body: JSON.stringify({ uid }) }),
    disconnect: (accountId: string) => request<T.BankAccount>(`/bank-accounts/${accountId}/connect`, { method: 'DELETE' }),
    sync: (accountId: string) => request<T.BankSyncResult>(`/bank-accounts/${accountId}/sync`, { method: 'POST' }),
    transactions: (filter: T.BankTransactionFilter = {}) =>
      request<T.BankTransaction[]>(`/bank-transactions${query({ ...filter, year: filter.year?.toString() })}`),
    match: (id: string, allocations: T.BankAllocation[]) =>
      request<T.BankTransaction>(`/bank-transactions/${id}/match`, { method: 'POST', body: JSON.stringify({ allocations }) }),
    unmatch: (id: string) => request<T.BankTransaction>(`/bank-transactions/${id}/match`, { method: 'DELETE' }),
    setStatus: (id: string, status: 'IGNORED' | 'UNMATCHED') =>
      request<T.BankTransaction>(`/bank-transactions/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  },
  documents: {
    list: (filter: T.DocumentFilter = {}) => request<T.DocumentItem[]>(`/documents${query({ ...filter })}`),
    /** Le fichier part brut dans le corps, avec son type ; rattachement, type et nom dans l'URL */
    upload: (target: T.DocumentTarget, category: T.DocumentCategory, file: File, label?: string) =>
      request<T.DocumentItem>(`/documents${query({ ...target, category, fileName: file.name, label })}`, {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      }),
    update: (id: string, data: { label?: string; category?: T.DocumentCategory }) =>
      request<T.DocumentItem>(`/documents/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/documents/${id}`, { method: 'DELETE' }),
    fileUrl: (id: string, download = false) => `${BASE}/documents/${id}/file${download ? '?download' : ''}`,
  },
  irl: {
    list: () => request<T.IrlIndex[]>('/irl'),
    save: (data: { quarter: number; year: number; value: number }) =>
      request<T.IrlIndex>('/irl', { method: 'PUT', body: JSON.stringify(data) }),
    lastSync: () => request<T.IrlSyncResult | null>('/irl/sync'),
    sync: () => request<T.IrlSyncResult>('/irl/sync', { method: 'POST' }),
  },
  revisions: {
    list: (leaseId: string) => request<T.RentRevision[]>(`/leases/${leaseId}/revisions`),
    preview: (leaseId: string, date?: string) =>
      request<T.RevisionPreview>(`/leases/${leaseId}/revisions/preview${date ? `?date=${encodeURIComponent(date)}` : ''}`),
    apply: (leaseId: string, data: { effectiveDate: string; newRent?: number }) =>
      request<T.RentRevision>(`/leases/${leaseId}/revisions`, { method: 'POST', body: JSON.stringify(data) }),
    cancel: (leaseId: string, id: string) => request<void>(`/leases/${leaseId}/revisions/${id}`, { method: 'DELETE' }),
    letterUrl: (leaseId: string, id: string, download = false) =>
      `${BASE}/leases/${leaseId}/revisions/${id}/letter${download ? '?download' : ''}`,
  },
  notifications: {
    list: () => request<T.AppNotification[]>('/notifications'),
    read: (id: string) => request<void>(`/notifications/${id}/read`, { method: 'POST' }),
    readAll: () => request<void>('/notifications/read-all', { method: 'POST' }),
    test: () => request<T.NotificationTestResult>('/notifications/test', { method: 'POST' }),
    upcoming: () => request<T.UpcomingReminder[]>('/notifications/upcoming'),
    check: () => request<{ created: number; upcoming: T.UpcomingReminder[] }>('/notifications/check', { method: 'POST' }),
  },
  charges: {
    list: (year: number) => request<T.Charge[]>(`/charges?year=${year}`),
    create: (data: T.CreateChargeInput) => request<T.Charge>('/charges', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Omit<T.CreateChargeInput, 'propertyId'>>) =>
      request<T.Charge>(`/charges/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/charges/${id}`, { method: 'DELETE' }),
    allocation: (year: number) => request<T.ChargeAllocation[]>(`/charges/allocation?year=${year}`),
    outdatedRegularizations: () => request<T.OutdatedRegularization[]>('/charges/outdated-regularizations'),
  },
  regularizations: {
    list: (leaseId: string) => request<T.ChargeRegularization[]>(`/leases/${leaseId}/regularizations`),
    preview: (leaseId: string, year: number) =>
      request<T.RegularizationPreview>(`/leases/${leaseId}/regularizations/preview?year=${year}`),
    create: (leaseId: string, year: number) =>
      request<T.ChargeRegularization>(`/leases/${leaseId}/regularizations`, { method: 'POST', body: JSON.stringify({ year }) }),
    delete: (leaseId: string, id: string) => request<void>(`/leases/${leaseId}/regularizations/${id}`, { method: 'DELETE' }),
    statementUrl: (leaseId: string, id: string, download = false) =>
      `${BASE}/leases/${leaseId}/regularizations/${id}/statement${download ? '?download' : ''}`,
  },
  properties: {
    list: () => request<import('../types').Property[]>('/properties'),
    get: (id: string) => request<import('../types').Property>(`/properties/${id}`),
    create: (data: import('../types').CreatePropertyInput) =>
      request<import('../types').Property>('/properties', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<import('../types').CreatePropertyInput>) =>
      request<import('../types').Property>(`/properties/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/properties/${id}`, { method: 'DELETE' }),
    setOwners: (id: string, owners: T.OwnerInput[]) =>
      request<import('../types').Ownership[]>(`/properties/${id}/owners`, { method: 'PUT', body: JSON.stringify({ owners }) }),
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
    /** Toutes les échéances d'une année (page Paiements) */
    listByYear: (year: number) =>
      request<import('../types').RentPayment[]>(`/rent-payments?year=${year}`),
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
  auth: {
    login: (email: string, password: string) =>
      request<import('../types').Profile>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    logout: () => request<void>('/auth/logout', { method: 'POST' }),
  },
  me: {
    get: () => request<import('../types').Profile>('/me'),
    update: (data: import('../types').UpdateProfileInput) =>
      request<import('../types').Profile>('/me', { method: 'PATCH', body: JSON.stringify(data) }),
    changePassword: (currentPassword: string, newPassword: string) =>
      request<import('../types').Profile>('/me/password', { method: 'PUT', body: JSON.stringify({ currentPassword, newPassword }) }),
    /** image : data URL PNG ou JPEG */
    setSignature: (image: string) =>
      request<import('../types').Profile>('/me/signature', { method: 'PUT', body: JSON.stringify({ image }) }),
    deleteSignature: () => request<import('../types').Profile>('/me/signature', { method: 'DELETE' }),
    signatureUrl: `${BASE}/me/signature`,
  },
  users: {
    directory: () => request<import('../types').DirectoryUser[]>('/users'),
    create: (data: import('../types').CreateUserInput) =>
      request<import('../types').Profile>('/users', { method: 'POST', body: JSON.stringify(data) }),
    resetPassword: (id: string, password: string) =>
      request<void>(`/users/${id}/password`, { method: 'PUT', body: JSON.stringify({ password }) }),
    setRole: (id: string, role: 'ADMIN' | 'USER') =>
      request<import('../types').DirectoryUser>(`/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
  },
}
