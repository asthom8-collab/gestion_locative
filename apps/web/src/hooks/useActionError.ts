import { useCallback, useState } from 'react'

/**
 * Exécute une action (mutation) et garde le message d'erreur de l'API pour l'afficher
 * (ex. 409 « bail actif », 400 de validation) au lieu de le perdre en silence.
 * `run` renvoie true si l'action a réussi.
 */
export function useActionError() {
  const [error, setError] = useState<string | null>(null)
  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setError(null)
    try {
      await fn()
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
      return false
    }
  }, [])
  return { error, run, clear: () => setError(null) }
}
