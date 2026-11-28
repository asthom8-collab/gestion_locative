import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { InterventionFilter, InterventionInput } from '../types'

export const useInterventions = (filter: InterventionFilter = {}) =>
  useQuery({ queryKey: ['interventions', filter], queryFn: () => api.interventions.list(filter) })

function useInterventionMutation<V>(fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['interventions'] })
      qc.invalidateQueries({ queryKey: ['documents'] }) // une facture perd son lien quand l'intervention est supprimée
    },
  })
}

export const useCreateIntervention = () => useInterventionMutation((data: InterventionInput) => api.interventions.create(data))
export const useUpdateIntervention = () =>
  useInterventionMutation(({ id, data }: { id: string; data: Partial<Omit<InterventionInput, 'propertyId'>> }) => api.interventions.update(id, data))
export const useDeleteIntervention = () => useInterventionMutation((id: string) => api.interventions.delete(id))
