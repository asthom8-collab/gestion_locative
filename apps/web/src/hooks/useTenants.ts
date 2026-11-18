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
