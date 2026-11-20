import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTenants, useCreateTenant, useUpdateTenant, useDeleteTenant } from '../hooks/useTenants'
import { useActionError } from '../hooks/useActionError'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Field, inputCls } from '../components/ui/Field'
import { Empty } from '../components/ui/Empty'
import { ErrorAlert } from '../components/ui/ErrorAlert'
import { Users, Plus, Pencil, Trash2, Check, Mail, Phone } from '../components/icons'
import { eur, fmtMonth, initials } from '../lib/format'
import type { CreateTenantInput, Tenant } from '../types'

const blank: CreateTenantInput = { firstName: '', lastName: '', email: '', phone: '' }
type Tab = 'current' | 'former'

function TenantCard({ t, current, onEdit, onRemove }: { t: Tenant; current: boolean; onEdit: () => void; onRemove: () => void }) {
  const leases = [...(t.leases ?? [])].sort((a, b) => b.startDate.localeCompare(a.startDate))
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`grid place-items-center w-10 h-10 rounded-full text-sm font-semibold shrink-0 ${current ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
            {initials(t) || '?'}
          </div>
          <div className="min-w-0">
            <div className="font-medium text-slate-900 truncate">{t.firstName} {t.lastName}</div>
            {t.email && <div className="text-xs text-slate-500 flex items-center gap-1 truncate"><Mail size={11} className="shrink-0" />{t.email}</div>}
            {t.phone && <div className="text-xs text-slate-500 flex items-center gap-1"><Phone size={11} className="shrink-0" />{t.phone}</div>}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={onEdit} aria-label={`Modifier ${t.firstName} ${t.lastName}`} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><Pencil size={15} /></button>
          <button onClick={onRemove} aria-label={`Supprimer ${t.firstName} ${t.lastName}`} className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600"><Trash2 size={15} /></button>
        </div>
      </div>

      {leases.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">{current ? 'Baux' : 'Historique des baux'}</div>
          {leases.map(l => (
            <Link key={l.id} to={`/leases/${l.id}`}
              className="flex items-center justify-between bg-slate-50 hover:bg-slate-100 rounded-lg px-3 py-2 transition-colors">
              <div className="min-w-0">
                <div className="text-xs font-medium text-slate-700 truncate">{l.property?.name ?? 'Bien'}</div>
                <div className="text-[11px] text-slate-400">{fmtMonth(l.startDate)} → {l.active ? 'En cours' : fmtMonth(l.endDate)}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs font-semibold text-slate-700">{eur(l.rentAmount + l.chargesAmount)}</div>
                {l.chargesAmount > 0 && <div className="text-[11px] text-slate-400">dont {eur(l.chargesAmount)} ch.</div>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  )
}

export function Tenants() {
  const { data: tenants = [], isLoading } = useTenants()
  const createM = useCreateTenant()
  const updateM = useUpdateTenant()
  const deleteM = useDeleteTenant()
  const page = useActionError()
  const modalErr = useActionError()

  const [tab, setTab] = useState<Tab>('current')
  const [modal, setModal] = useState<'create' | Tenant | null>(null)
  const [form, setForm] = useState<CreateTenantInput>(blank)

  const openCreate = () => { modalErr.clear(); setForm(blank); setModal('create') }
  const openEdit = (t: Tenant) => {
    modalErr.clear()
    setForm({ firstName: t.firstName, lastName: t.lastName, email: t.email, phone: t.phone ?? '' })
    setModal(t)
  }

  const save = async () => {
    const ok = await modalErr.run(() =>
      modal === 'create' ? createM.mutateAsync(form) : updateM.mutateAsync({ id: (modal as Tenant).id, data: form }))
    if (ok) setModal(null)
  }

  // L'API refuse (409) la suppression d'un locataire qui a un bail, en cours ou passé : on affiche son message
  const remove = (t: Tenant) => {
    if (!confirm(`Supprimer ${t.firstName} ${t.lastName} ?`)) return
    page.run(() => deleteM.mutateAsync(t.id))
  }

  if (isLoading) return <div className="text-slate-400 text-sm py-8 text-center">Chargement…</div>

  const isCurrent = (t: Tenant) => !!t.leases?.some(l => l.active)
  const current = tenants.filter(isCurrent)
  const former = tenants.filter(t => !isCurrent(t))
  const shown = tab === 'current' ? current : former
  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'current', label: 'En cours', count: current.length },
    { id: 'former', label: 'Anciens et sans bail', count: former.length },
  ]

  return (
    <div>
      <PageHeader title="Mes locataires" action={<Button onClick={openCreate}><Plus size={16} />Ajouter</Button>} />
      <ErrorAlert message={page.error} onClose={page.clear} />

      {tenants.length === 0 ? (
        <Card><Empty Icon={Users} title="Aucun locataire" hint="Ajoutez un locataire pour l'associer à un bail." action={{ label: 'Ajouter', onClick: openCreate }} /></Card>
      ) : (
        <>
          <div role="tablist" className="flex gap-1 mb-4 bg-slate-100 rounded-xl p-1">
            {tabs.map(x => (
              <button key={x.id} role="tab" aria-selected={tab === x.id} onClick={() => setTab(x.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === x.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {x.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${tab === x.id ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-500'}`}>{x.count}</span>
              </button>
            ))}
          </div>
          {shown.length === 0 ? (
            <Card><Empty Icon={Users} title={tab === 'current' ? 'Aucun locataire en cours' : 'Aucun ancien locataire'} /></Card>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3 items-start">
              {shown.map(t => (
                <TenantCard key={t.id} t={t} current={tab === 'current'} onEdit={() => openEdit(t)} onRemove={() => remove(t)} />
              ))}
            </div>
          )}
        </>
      )}

      {modal && (
        <Modal title={modal === 'create' ? 'Nouveau locataire' : 'Modifier le locataire'} onClose={() => setModal(null)}>
          <ErrorAlert message={modalErr.error} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prénom"><input className={inputCls} value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} /></Field>
            <Field label="Nom"><input className={inputCls} value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} /></Field>
          </div>
          <Field label="Email"><input className={inputCls} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Téléphone"><input className={inputCls} value={form.phone ?? ''} onChange={e => setForm({ ...form, phone: e.target.value })} /></Field>
          <div className="flex justify-end mt-2">
            <Button onClick={save} disabled={createM.isPending || updateM.isPending}><Check size={16} />Enregistrer</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
