import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { CreateLeaseInput, UpdateLeaseInput } from '../types'

export function useLeases() {
  return useQuery({ queryKey: ['leases'], queryFn: api.leases.list })
}

export function useLease(id: string) {
  return useQuery({ queryKey: ['leases', id], queryFn: () => api.leases.get(id) })
}

export function useUpdateLease() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateLeaseInput }) => api.leases.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leases'] })
      qc.invalidateQueries({ queryKey: ['properties'] })
      qc.invalidateQueries({ queryKey: ['tenants'] })
    },
  })
}

export function useCreateLease() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateLeaseInput) => api.leases.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leases'] })
      qc.invalidateQueries({ queryKey: ['properties'] })
      qc.invalidateQueries({ queryKey: ['tenants'] })
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
      qc.invalidateQueries({ queryKey: ['tenants'] })
      qc.invalidateQueries({ queryKey: ['rent-payments'] })
    },
  })
}
