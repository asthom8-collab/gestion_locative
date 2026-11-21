import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

/** Notifications de l'utilisateur, rechargées toutes les 5 minutes (rappels créés par l'API en tâche de fond). */
export const useNotifications = () =>
  useQuery({ queryKey: ['notifications'], queryFn: api.notifications.list, refetchInterval: 5 * 60_000, retry: false })

function useNotificationMutation<V>(fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) })
}

export const useMarkRead = () => useNotificationMutation((id: string) => api.notifications.read(id))
export const useMarkAllRead = () => useNotificationMutation((_: void) => api.notifications.readAll())
export const useTestNotification = () => useNotificationMutation((_: void) => api.notifications.test())
