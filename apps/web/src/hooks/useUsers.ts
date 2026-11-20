import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { CreateUserInput } from '../types'

export function useDirectory() {
  return useQuery({ queryKey: ['users'], queryFn: api.users.directory })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateUserInput) => api.users.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}

export const useResetPassword = () =>
  useMutation({ mutationFn: ({ id, password }: { id: string; password: string }) => api.users.resetPassword(id, password) })
