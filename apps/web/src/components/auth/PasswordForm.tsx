import { useState } from 'react'
import { useChangePassword } from '../../hooks/useMe'
import { Button } from '../ui/Button'
import { Field, inputCls } from '../ui/Field'
import { ErrorAlert } from '../ui/ErrorAlert'
import { Check } from '../icons'

/** Changement de mot de passe (Paramètres, et premier accès avec un mot de passe provisoire). */
export function PasswordForm({ onDone, submitLabel = 'Changer le mot de passe' }: { onDone?: () => void; submitLabel?: string }) {
  const changeM = useChangePassword()
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [localError, setLocalError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setDone(false)
    if (form.next.length < 8) return setLocalError('Le nouveau mot de passe doit faire au moins 8 caractères')
    if (form.next !== form.confirm) return setLocalError('Les deux saisies du nouveau mot de passe sont différentes')
    setLocalError(null)
    try {
      await changeM.mutateAsync({ currentPassword: form.current, newPassword: form.next })
      setForm({ current: '', next: '', confirm: '' })
      setDone(true)
      onDone?.()
    } catch {
      // message affiché via changeM.error
    }
  }
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })

  return (
    <form onSubmit={submit}>
      <ErrorAlert message={localError ?? changeM.error?.message ?? null} />
      <Field label="Mot de passe actuel">
        <input className={inputCls} type="password" autoComplete="current-password" required value={form.current} onChange={set('current')} />
      </Field>
      <Field label="Nouveau mot de passe (8 caractères minimum)">
        <input className={inputCls} type="password" autoComplete="new-password" required value={form.next} onChange={set('next')} />
      </Field>
      <Field label="Confirmer le nouveau mot de passe">
        <input className={inputCls} type="password" autoComplete="new-password" required value={form.confirm} onChange={set('confirm')} />
      </Field>
      <div className="flex items-center justify-end gap-3">
        {done && <span className="text-sm text-emerald-600">Mot de passe modifié</span>}
        <Button type="submit" disabled={changeM.isPending}><Check size={16} />{submitLabel}</Button>
      </div>
    </form>
  )
}
