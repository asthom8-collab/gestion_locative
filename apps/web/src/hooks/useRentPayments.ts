import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

const key = (year: number, month: number) => ['rent-payments', year, month]

export function useRentPayments(year: number, month: number) {
  return useQuery({ queryKey: key(year, month), queryFn: () => api.rentPayments.list(year, month) })
}

/** Toutes les mutations d'échéances rafraîchissent les listes de loyers. */
function useRentMutation<V, R>(fn: (vars: V) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rent-payments'] }),
  })
}

export const useGenerateRentPayments = () =>
  useRentMutation(({ year, month }: { year: number; month: number }) => api.rentPayments.generate(year, month))

export const useRecordPayment = () =>
  useRentMutation(({ id, receivedAmount, paymentDate }: { id: string; receivedAmount: number; paymentDate: string }) =>
    api.rentPayments.recordPayment(id, receivedAmount, paymentDate))

export const useCancelPayment = () => useRentMutation((id: string) => api.rentPayments.cancelPayment(id))

export const useDeleteRentPayment = () => useRentMutation((id: string) => api.rentPayments.delete(id))

export const useGenerateReceipt = () => useRentMutation((id: string) => api.rentPayments.generateReceipt(id))
