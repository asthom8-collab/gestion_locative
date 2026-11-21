import { useEffect, useState } from 'react'
import { useMe, useUpdateMe } from '../hooks/useMe'
import { SignatureCard, PasswordCard, AccountsCard, IrlCard } from './settings/sections'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Field, inputCls } from '../components/ui/Field'
import { Check } from '../components/icons'

type Form = { firstName: string; lastName: string; address: string; zipCode: string; city: string }

export function Settings() {
  const { data: me, isLoading } = useMe()
  const updateM = useUpdateMe()
  const [form, setForm] = useState<Form | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (me && !form) {
      setForm({
        firstName: me.firstName,
        lastName: me.lastName,
        address: me.address ?? '',
        zipCode: me.zipCode ?? '',
        city: me.city ?? '',
      })
    }
  }, [me, form])

  if (isLoading || !form) return <div className="text-slate-400 text-sm py-8 text-center">Chargement…</div>

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setSaved(false)
    setForm({ ...form, [k]: e.target.value })
  }
  const save = async () => {
    try {
      await updateM.mutateAsync(form)
      setSaved(true)
    } catch {
      // l'erreur est affichée via updateM.error
    }
  }

  return (
    <div>
      <PageHeader title="Paramètres" subtitle={me?.email} />
      <div className="space-y-4 max-w-xl">
      <Card className="p-5">
        <h3 className="font-semibold text-slate-900 mb-1">Identité du bailleur</h3>
        <p className="text-sm text-slate-500 mb-4">Ces informations sont imprimées sur les quittances de loyer.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prénom"><input className={inputCls} value={form.firstName} onChange={set('firstName')} /></Field>
          <Field label="Nom"><input className={inputCls} value={form.lastName} onChange={set('lastName')} /></Field>
        </div>
        <Field label="Adresse"><input className={inputCls} value={form.address} onChange={set('address')} /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Code postal"><input className={inputCls} value={form.zipCode} onChange={set('zipCode')} /></Field>
          <div className="col-span-2">
            <Field label="Ville"><input className={inputCls} value={form.city} onChange={set('city')} /></Field>
          </div>
        </div>
        {updateM.error && <p role="alert" className="text-sm text-rose-600 mb-3">{updateM.error.message}</p>}
        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-sm text-emerald-600">Enregistré</span>}
          <Button onClick={save} disabled={updateM.isPending || !form.firstName.trim() || !form.lastName.trim()}>
            <Check size={16} />Enregistrer
          </Button>
        </div>
      </Card>
      <SignatureCard />
      <PasswordCard />
      <IrlCard />
      {me?.role === 'ADMIN' && <AccountsCard />}
      </div>
    </div>
  )
}
