import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

/** Notifications de l'utilisateur, rechargées toutes les 5 minutes (rappels créés par l'API en tâche de fond). */
export const useNotifications = () =>
  useQuery({ queryKey: ['notifications'], queryFn: api.notifications.list, refetchInterval: 5 * 60_000, retry: false })

/** Prochains rappels de révision (date anniversaire, date d'envoi, état). */
export const useUpcomingReminders = () =>
  useQuery({ queryKey: ['notifications', 'upcoming'], queryFn: api.notifications.upcoming, retry: false })

function useNotificationMutation<V>(fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) })
}

/** Cherche tout de suite les rappels à envoyer (sinon : au démarrage de l'API puis toutes les 6 h). */
export const useCheckReminders = () => useNotificationMutation((_: void) => api.notifications.check())

export const useMarkRead = () => useNotificationMutation((id: string) => api.notifications.read(id))
export const useMarkAllRead = () => useNotificationMutation((_: void) => api.notifications.readAll())
export const useTestNotification = () => useNotificationMutation((_: void) => api.notifications.test())
