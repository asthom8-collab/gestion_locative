import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

export const useIrlIndexes = () => useQuery({ queryKey: ['irl'], queryFn: api.irl.list })

export function useSaveIrl() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.irl.save,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['irl'] })
      qc.invalidateQueries({ queryKey: ['revisions'] })
    },
  })
}

export const useRevisions = (leaseId: string) =>
  useQuery({ queryKey: ['revisions', leaseId, 'list'], queryFn: () => api.revisions.list(leaseId) })

/** Proposition de révision ; date = date d'effet choisie (sinon l'anniversaire, ou aujourd'hui s'il est passé). */
export const useRevisionPreview = (leaseId: string, date?: string, enabled = true) =>
  useQuery({ queryKey: ['revisions', leaseId, 'preview', date ?? null], queryFn: () => api.revisions.preview(leaseId, date), enabled })

function useInvalidateLease() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['revisions'] })
    qc.invalidateQueries({ queryKey: ['leases'] })
    qc.invalidateQueries({ queryKey: ['properties'] })
    qc.invalidateQueries({ queryKey: ['rent-payments'] })
  }
}

export function useApplyRevision() {
  const invalidate = useInvalidateLease()
  return useMutation({
    mutationFn: ({ leaseId, ...data }: { leaseId: string; effectiveDate: string; newRent?: number }) => api.revisions.apply(leaseId, data),
    onSuccess: invalidate,
  })
}

export function useCancelRevision() {
  const invalidate = useInvalidateLease()
  return useMutation({
    mutationFn: ({ leaseId, id }: { leaseId: string; id: string }) => api.revisions.cancel(leaseId, id),
    onSuccess: invalidate,
  })
}
