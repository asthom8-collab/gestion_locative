import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { CreateChargeInput } from '../types'

export const useCharges = (year: number) => useQuery({ queryKey: ['charges', year], queryFn: () => api.charges.list(year) })
/** Répartition des charges de l'année entre propriétaires (quotes-parts datées). */
export const useChargeAllocation = (year: number) =>
  useQuery({ queryKey: ['charges', 'allocation', year], queryFn: () => api.charges.allocation(year) })

function useChargeMutation<V>(fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['charges'] })
      qc.invalidateQueries({ queryKey: ['regularizations'] })
    },
  })
}

export const useCreateCharge = () => useChargeMutation((data: CreateChargeInput) => api.charges.create(data))
export const useUpdateCharge = () =>
  useChargeMutation(({ id, data }: { id: string; data: Partial<Omit<CreateChargeInput, 'propertyId'>> }) => api.charges.update(id, data))
export const useDeleteCharge = () => useChargeMutation((id: string) => api.charges.delete(id))

export const useRegularizations = (leaseId: string) =>
  useQuery({ queryKey: ['regularizations', leaseId, 'list'], queryFn: () => api.regularizations.list(leaseId) })

export const useRegularizationPreview = (leaseId: string, year: number) =>
  useQuery({ queryKey: ['regularizations', leaseId, 'preview', year], queryFn: () => api.regularizations.preview(leaseId, year), retry: false })

export const useCreateRegularization = () =>
  useChargeMutation(({ leaseId, year }: { leaseId: string; year: number }) => api.regularizations.create(leaseId, year))
export const useDeleteRegularization = () =>
  useChargeMutation(({ leaseId, id }: { leaseId: string; id: string }) => api.regularizations.delete(leaseId, id))
