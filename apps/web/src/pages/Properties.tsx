import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useProperties, useCreateProperty, useUpdateProperty, useDeleteProperty } from '../hooks/useProperties'
import { useActionError } from '../hooks/useActionError'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Field, inputCls } from '../components/ui/Field'
import { Empty } from '../components/ui/Empty'
import { ErrorAlert } from '../components/ui/ErrorAlert'
import { PropTypeIcon } from '../components/ui/PropTypeIcon'
import { Building2, Plus, Pencil, Trash2, MapPin, Check, ChevronRight, ClipboardList, UserCircle2 } from '../components/icons'
import { eur, fmtMonth, fullName, PROPERTY_TYPE_LABELS, FISCAL_REGIMES } from '../lib/format'
import type { CreatePropertyInput, Lease, Property, PropertyType, FiscalRegime } from '../types'

const TYPES = Object.keys(PROPERTY_TYPE_LABELS) as PropertyType[]
const REGIMES = Object.keys(FISCAL_REGIMES) as FiscalRegime[]

const blank: CreatePropertyInput = { name: '', address: '', zipCode: '', city: '', type: 'APARTMENT', surface: 0, fiscalRegime: 'NU', irlQuarter: 2 }

type Segment = { kind: 'lease'; lease: Lease } | { kind: 'vacant'; start: string; end: string }

/** Baux du bien dans l'ordre chronologique, avec les périodes de vacance entre deux baux. */
export function historySegments(leases: Lease[]): Segment[] {
  const sorted = [...leases].sort((a, b) => a.startDate.localeCompare(b.startDate))
  const out: Segment[] = []
  sorted.forEach((l, i) => {
    const prev = sorted[i - 1]
    // Vacance seulement s'il reste au moins un jour entier sans bail (la date de fin est incluse dans le bail)
    if (prev?.endDate && Date.parse(l.startDate) - Date.parse(prev.endDate) > 86_400_000)
      out.push({ kind: 'vacant', start: prev.endDate, end: l.startDate })
    out.push({ kind: 'lease', lease: l })
  })
  return out
}

function PropertyHistory({ leases }: { leases: Lease[] }) {
  const [open, setOpen] = useState(false)
  if (leases.length === 0) return null
  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <button onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 font-medium w-full">
        <ClipboardList size={13} />
        Historique des locataires ({leases.length})
        <ChevronRight size={13} className={`ml-auto transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="mt-2 space-y-1.5">
          {historySegments(leases).map((seg, i) => seg.kind === 'vacant' ? (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-dashed border-slate-200">
              <div className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
              <div className="text-[11px] text-slate-400 italic">Vacant · {fmtMonth(seg.start)} → {fmtMonth(seg.end)}</div>
            </div>
          ) : (
            <div key={i} className="px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-100">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-slate-800">{fullName(seg.lease.tenant)}</div>
                <div className="text-xs font-semibold text-slate-700">{eur(seg.lease.rentAmount + seg.lease.chargesAmount)}</div>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5 flex items-center justify-between">
                <span>{fmtMonth(seg.lease.startDate)} → {seg.lease.active ? 'En cours' : fmtMonth(seg.lease.endDate)}</span>
                {seg.lease.chargesAmount > 0 && <span>dont {eur(seg.lease.chargesAmount)} ch.</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function Properties() {
  const { data: properties = [], isLoading } = useProperties()
  const createM = useCreateProperty()
  const updateM = useUpdateProperty()
  const deleteM = useDeleteProperty()
  const page = useActionError()
  const modalErr = useActionError()

  const [modal, setModal] = useState<'create' | Property | null>(null)
  const [form, setForm] = useState<CreatePropertyInput>(blank)

  const openCreate = () => { modalErr.clear(); setForm(blank); setModal('create') }
  const openEdit = (p: Property) => {
    modalErr.clear()
    setForm({ name: p.name, address: p.address, zipCode: p.zipCode, city: p.city, type: p.type, surface: p.surface, fiscalRegime: p.fiscalRegime, irlQuarter: p.irlQuarter })
    setModal(p)
  }

  const save = async () => {
    const ok = await modalErr.run(() =>
      modal === 'create' ? createM.mutateAsync(form) : updateM.mutateAsync({ id: (modal as Property).id, data: form }))
    if (ok) setModal(null)
  }

  const remove = (p: Property) => {
    if (!confirm(`Supprimer « ${p.name} » ?`)) return
    page.run(() => deleteM.mutateAsync(p.id))
  }

  if (isLoading) return <div className="text-slate-400 text-sm py-8 text-center">Chargement…</div>

  return (
    <div>
      <PageHeader title="Mes biens" action={<Button onClick={openCreate}><Plus size={16} />Ajouter</Button>} />
      <ErrorAlert message={page.error} onClose={page.clear} />
      {properties.length === 0 ? (
        <Card><Empty Icon={Building2} title="Aucun bien" hint="Ajoutez votre premier bien pour commencer." action={{ label: 'Ajouter un bien', onClick: openCreate }} /></Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3 items-start">
          {properties.map(p => {
            const occupied = !!p.leases?.some(l => l.active)
            const fiscal = FISCAL_REGIMES[p.fiscalRegime]
            const owners = p.ownerships ?? []
            return (
              <Card key={p.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <PropTypeIcon type={p.type} />
                      <span className="font-medium text-slate-900 truncate">{p.name}</span>
                      <Badge ok={occupied} on="Occupé" off="Vacant" />
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                      <MapPin size={12} className="shrink-0" /><span className="truncate">{p.address}, {p.zipCode} {p.city}</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
                      <span>{PROPERTY_TYPE_LABELS[p.type]}{p.surface ? ` · ${p.surface} m²` : ''}</span>
                      {fiscal.badge && <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${fiscal.color}`}>{fiscal.badge}</span>}
                    </div>
                    {owners.length > 0 && (
                      <Link to={`/owners?property=${p.id}`} title="Voir les propriétaires de ce bien" className="text-xs text-slate-400 hover:text-indigo-600 mt-0.5 flex items-center gap-1">
                        <UserCircle2 size={11} className="shrink-0" />
                        <span className="truncate">{owners.map(o => `${fullName(o.user)}${owners.length > 1 ? ` (${Math.round(o.share * 100)} %)` : ''}`).join(' · ')}</span>
                      </Link>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(p)} aria-label={`Modifier ${p.name}`} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><Pencil size={15} /></button>
                    <button onClick={() => remove(p)} aria-label={`Supprimer ${p.name}`} className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600"><Trash2 size={15} /></button>
                  </div>
                </div>
                <PropertyHistory leases={p.leases ?? []} />
              </Card>
            )
          })}
        </div>
      )}


      {modal && (
        <Modal title={modal === 'create' ? 'Nouveau bien' : 'Modifier le bien'} onClose={() => setModal(null)}>
          <ErrorAlert message={modalErr.error} />
          <Field label="Nom / désignation">
            <input className={inputCls} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex. T3 rue Lafayette" />
          </Field>
          <Field label="Adresse">
            <input className={inputCls} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code postal">
              <input className={inputCls} value={form.zipCode} onChange={e => setForm({ ...form, zipCode: e.target.value })} maxLength={5} />
            </Field>
            <Field label="Ville">
              <input className={inputCls} value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <select className={inputCls} value={form.type} onChange={e => setForm({ ...form, type: e.target.value as PropertyType })}>
                {TYPES.map(t => <option key={t} value={t}>{PROPERTY_TYPE_LABELS[t]}</option>)}
              </select>
            </Field>
            <Field label="Surface (m²)">
              <input className={inputCls} type="number" value={form.surface} onChange={e => setForm({ ...form, surface: Number(e.target.value) })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Régime fiscal">
              <select className={inputCls} value={form.fiscalRegime} onChange={e => setForm({ ...form, fiscalRegime: e.target.value as FiscalRegime })}>
                {REGIMES.map(r => <option key={r} value={r}>{FISCAL_REGIMES[r].label}</option>)}
              </select>
            </Field>
            <Field label="Trimestre IRL (1-4)">
              <input className={inputCls} type="number" min={1} max={4} value={form.irlQuarter} onChange={e => setForm({ ...form, irlQuarter: Number(e.target.value) })} />
            </Field>
          </div>
          <div className="flex justify-end mt-2">
            <Button onClick={save} disabled={createM.isPending || updateM.isPending}><Check size={16} />Enregistrer</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
