import { useMe } from '../../hooks/useMe'
import { isUnauthorized } from '../../api/client'
import { Login, AuthLayout } from './Login'
import { PasswordForm } from './PasswordForm'
import { Card } from '../ui/Card'
import { ErrorAlert } from '../ui/ErrorAlert'

/**
 * Affiche l'application seulement pour un utilisateur connecté. Sinon : écran de connexion,
 * ou changement obligatoire du mot de passe provisoire.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { data: me, error, isLoading } = useMe()

  if (isLoading) return <div className="min-h-screen bg-slate-50 grid place-items-center text-slate-400 text-sm">Chargement…</div>
  if (isUnauthorized(error) || (!me && !error)) return <Login />
  if (!me) return <AuthLayout><ErrorAlert message={error?.message ?? 'API injoignable'} /></AuthLayout>
  if (me.mustChangePassword)
    return (
      <AuthLayout>
        <Card className="p-6">
          <h1 className="text-lg font-semibold tracking-tight text-slate-900 mb-1">Bienvenue {me.firstName}</h1>
          <p className="text-sm text-slate-500 mb-4">Votre compte a un mot de passe provisoire : choisissez le vôtre pour continuer.</p>
          <PasswordForm submitLabel="Enregistrer et continuer" />
        </Card>
      </AuthLayout>
    )
  return <>{children}</>
}
