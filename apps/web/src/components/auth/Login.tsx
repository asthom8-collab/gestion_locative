import { useState } from 'react'
import { useLogin } from '../../hooks/useMe'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Field, inputCls } from '../ui/Field'
import { ErrorAlert } from '../ui/ErrorAlert'
import { Building2 } from '../icons'

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 grid place-items-center px-4" style={{ fontFamily: "'Segoe UI',system-ui,-apple-system,sans-serif" }}>
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <div className="grid place-items-center w-10 h-10 rounded-lg bg-indigo-600 text-white"><Building2 size={20} /></div>
          <div>
            <div className="font-semibold tracking-tight text-slate-900 leading-none">Gestion Locative</div>
            <div className="text-xs text-slate-500 mt-0.5">Espace bailleur</div>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Login() {
  const loginM = useLogin()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    loginM.mutate({ email: email.trim(), password })
  }

  return (
    <AuthLayout>
      <Card className="p-6">
        <h1 className="text-lg font-semibold tracking-tight text-slate-900 mb-4">Connexion</h1>
        <form onSubmit={submit}>
          <ErrorAlert message={loginM.error?.message ?? null} />
          <Field label="E-mail">
            <input className={inputCls} type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} />
          </Field>
          <Field label="Mot de passe">
            <input className={inputCls} type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
          </Field>
          <div className="flex justify-end mt-2">
            <Button type="submit" disabled={loginM.isPending}>Se connecter</Button>
          </div>
        </form>
      </Card>
      <p className="text-xs text-slate-400 text-center mt-4">Les comptes sont créés par l'administrateur.</p>
    </AuthLayout>
  )
}
