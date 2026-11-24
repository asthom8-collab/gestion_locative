import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { DocumentCategory, DocumentFilter, DocumentTarget } from '../types'

export function useDocuments(filter: DocumentFilter = {}) {
  return useQuery({ queryKey: ['documents', filter], queryFn: () => api.documents.list(filter) })
}

/** Toutes les mutations rafraîchissent toutes les listes de documents (page, bail, bien). */
function useDocMutation<V, R>(fn: (vars: V) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }) })
}

export const useUploadDocument = () =>
  useDocMutation(({ target, category, file, label }: { target: DocumentTarget; category: DocumentCategory; file: File; label?: string }) =>
    api.documents.upload(target, category, file, label))

export const useUpdateDocument = () =>
  useDocMutation(({ id, ...data }: { id: string; label?: string; category?: DocumentCategory }) => api.documents.update(id, data))

export const useDeleteDocument = () => useDocMutation((id: string) => api.documents.delete(id))
