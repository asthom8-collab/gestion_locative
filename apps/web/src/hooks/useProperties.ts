import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { CreatePropertyInput, OwnerInput } from '../types'

export function useProperties() {
  return useQuery({ queryKey: ['properties'], queryFn: api.properties.list })
}

export function useProperty(id: string) {
  return useQuery({ queryKey: ['properties', id], queryFn: () => api.properties.get(id), enabled: !!id })
}

export function useCreateProperty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreatePropertyInput) => api.properties.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties'] }),
  })
}

export function useUpdateProperty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreatePropertyInput> }) => api.properties.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties'] }),
  })
}

export function useDeleteProperty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.properties.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties'] }),
  })
}

export function useSetOwners() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, owners }: { id: string; owners: OwnerInput[] }) => api.properties.setOwners(id, owners),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties'] }),
  })
}
