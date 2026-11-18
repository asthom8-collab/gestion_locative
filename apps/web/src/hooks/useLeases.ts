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
