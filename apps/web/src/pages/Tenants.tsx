import { useState } from 'react'
import { useTenants, useCreateTenant, useUpdateTenant, useDeleteTenant } from '../hooks/useTenants'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Field, inputCls } from '../components/ui/Field'
import { Empty } from '../components/ui/Empty'
import { Users, Plus, Pencil, Trash2, Check } from '../components/icons'
import type { CreateTenantInput, Tenant } from '../types'

const blank: CreateTenantInput = { firstName: '', lastName: '', email: '', phone: '' }

const initials = (t: Tenant) => `${t.firstName[0] ?? ''}${t.lastName[0] ?? ''}`.toUpperCase()

export function Tenants() {
  const { data: tenants = [], isLoading } = useTenants()
  const createM = useCreateTenant()
  const updateM = useUpdateTenant()
  const deleteM = useDeleteTenant()

  const [modal, setModal] = useState<'create' | Tenant | null>(null)
  const [form, setForm] = useState<CreateTenantInput>(blank)

  const openCreate = () => { setForm(blank); setModal('create') }
  const openEdit = (t: Tenant) => { setForm({ firstName: t.firstName, lastName: t.lastName, email: t.email, phone: t.phone ?? '' }); setModal(t) }

  const save = async () => {
    if (modal === 'create') await createM.mutateAsync(form)
    else if (modal && typeof modal === 'object') await updateM.mutateAsync({ id: modal.id, data: form })
    setModal(null)
  }

  const remove = async (t: Tenant) => {
    if (t.leases?.some(l => l.active)) return alert('Locataire lié à un bail actif.')
    if (!confirm(`Supprimer ${t.firstName} ${t.lastName} ?`)) return
    await deleteM.mutateAsync(t.id)
  }

  if (isLoading) return <div className="text-slate-400 text-sm py-8 text-center">Chargement…</div>

  return (
    <div>
      <PageHeader title="Mes locataires" action={<Button onClick={openCreate}><Plus size={16} />Ajouter</Button>} />
      {tenants.length === 0 ? (
        <Card><Empty Icon={Users} title="Aucun locataire" hint="Ajoutez un locataire pour l'associer à un bail." action={{ label: 'Ajouter', onClick: openCreate }} /></Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {tenants.map(t => (
            <Card key={t.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid place-items-center w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 text-sm font-semibold shrink-0">
                    {initials(t)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 truncate">{t.firstName} {t.lastName}</div>
                    <div className="text-xs text-slate-500 truncate">{t.email}</div>
                    {t.phone && <div className="text-xs text-slate-400">{t.phone}</div>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><Pencil size={15} /></button>
                  <button onClick={() => remove(t)} className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600"><Trash2 size={15} /></button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {modal && (
        <Modal title={modal === 'create' ? 'Nouveau locataire' : 'Modifier le locataire'} onClose={() => setModal(null)}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prénom"><input className={inputCls} value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} /></Field>
            <Field label="Nom"><input className={inputCls} value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} /></Field>
          </div>
          <Field label="Email"><input className={inputCls} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Téléphone"><input className={inputCls} value={form.phone ?? ''} onChange={e => setForm({ ...form, phone: e.target.value })} /></Field>
          <div className="flex justify-end mt-2"><Button onClick={save}><Check size={16} />Enregistrer</Button></div>
        </Modal>
      )}
    </div>
  )
}
