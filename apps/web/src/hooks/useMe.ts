import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { UpdateProfileInput } from '../types'

export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: api.me.get })
}

export function useUpdateMe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateProfileInput) => api.me.update(data),
    onSuccess: (profile) => qc.setQueryData(['me'], profile),
  })
}
