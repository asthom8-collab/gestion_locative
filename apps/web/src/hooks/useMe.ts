import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, isUnauthorized } from '../api/client'
import type { Profile, UpdateProfileInput } from '../types'

/** Profil de l'utilisateur connecté. Une 401 veut dire « pas connecté » : pas de nouvel essai. */
export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: api.me.get,
    retry: (count, error) => !isUnauthorized(error) && count < 1,
  })
}

const useProfileMutation = <V,>(fn: (v: V) => Promise<Profile>) => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: (profile) => qc.setQueryData(['me'], profile) })
}

export const useUpdateMe = () => useProfileMutation((data: UpdateProfileInput) => api.me.update(data))

export const useChangePassword = () =>
  useProfileMutation(({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
    api.me.changePassword(currentPassword, newPassword))

export const useSetSignature = () => useProfileMutation((image: string) => api.me.setSignature(image))
export const useDeleteSignature = () => useProfileMutation((_: void) => api.me.deleteSignature())

/** Connexion : le profil renvoyé devient le profil courant, les autres données sont rechargées. */
export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => api.auth.login(email, password),
    onSuccess: (profile) => {
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' })
      qc.setQueryData(['me'], profile)
    },
  })
}

/** Déconnexion : on vide tout le cache (les données d'un autre utilisateur ne doivent pas rester). */
export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.auth.logout(),
    onSettled: () => {
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' })
      // Le profil est rechargé : la 401 affiche l'écran de connexion
      qc.resetQueries({ queryKey: ['me'] })
    },
  })
}
