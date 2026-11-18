import { useState } from 'react'
import { useProperties, useCreateProperty, useUpdateProperty, useDeleteProperty } from '../hooks/useProperties'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Field, inputCls } from '../components/ui/Field'
import { Empty } from '../components/ui/Empty'
import { Building2, Plus, Pencil, Trash2, MapPin, Check } from '../components/icons'
import type { CreatePropertyInput, Property, PropertyType, FiscalRegime } from '../types'

const TYPES: PropertyType[] = ['APARTMENT', 'HOUSE', 'PARKING', 'COMMERCIAL']
const REGIMES: { value: FiscalRegime; label: string }[] = [
  { value: 'NU', label: 'Location nue' },
  { value: 'PINEL', label: 'Pinel' },
  { value: 'LMNP_MICRO', label: 'LMNP micro-BIC' },
  { value: 'LMNP_REEL', label: 'LMNP réel' },
]
const TYPE_LABELS: Record<PropertyType, string> = { APARTMENT: 'Appartement', HOUSE: 'Maison', PARKING: 'Parking', COMMERCIAL: 'Local commercial' }

const blank: CreatePropertyInput = { name: '', address: '', zipCode: '', city: '', type: 'APARTMENT', surface: 0, fiscalRegime: 'NU', irlQuarter: 2 }

export function Properties() {
  const { data: properties = [], isLoading } = useProperties()
  const { data: leases = [] } = { data: [] as { propertyId: string; active: boolean }[] }
  const createM = useCreateProperty()
  const updateM = useUpdateProperty()
  const deleteM = useDeleteProperty()

  const [modal, setModal] = useState<'create' | Property | null>(null)
  const [form, setForm] = useState<CreatePropertyInput>(blank)

  const openCreate = () => { setForm(blank); setModal('create') }
  const openEdit = (p: Property) => { setForm({ name: p.name, address: p.address, zipCode: p.zipCode, city: p.city, type: p.type, surface: p.surface, fiscalRegime: p.fiscalRegime, irlQuarter: p.irlQuarter }); setModal(p) }

  const save = async () => {
    if (modal === 'create') await createM.mutateAsync(form)
    else if (modal && typeof modal === 'object') await updateM.mutateAsync({ id: modal.id, data: form })
    setModal(null)
  }

  const remove = async (p: Property) => {
    if (!confirm(`Supprimer « ${p.name} » ?`)) return
    await deleteM.mutateAsync(p.id)
  }

  if (isLoading) return <div className="text-slate-400 text-sm py-8 text-center">Chargement…</div>

  return (
    <div>
      <PageHeader title="Mes biens" action={<Button onClick={openCreate}><Plus size={16} />Ajouter</Button>} />
      {properties.length === 0 ? (
        <Card><Empty Icon={Building2} title="Aucun bien" hint="Ajoutez votre premier bien pour commencer." action={{ label: 'Ajouter un bien', onClick: openCreate }} /></Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {properties.map(p => {
            const hasActiveLease = p.leases?.some(l => l.active)
            return (
              <Card key={p.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-900 truncate">{p.name}</span>
                      <Badge ok={hasActiveLease} on="Occupé" off="Vacant" />
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                      <MapPin size={12} />{p.address}, {p.zipCode} {p.city}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {TYPE_LABELS[p.type]} · {p.surface} m²
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><Pencil size={15} /></button>
                    <button onClick={() => remove(p)} className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600"><Trash2 size={15} /></button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {modal && (
        <Modal title={modal === 'create' ? 'Nouveau bien' : 'Modifier le bien'} onClose={() => setModal(null)}>
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
                {TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </select>
            </Field>
            <Field label="Surface (m²)">
              <input className={inputCls} type="number" value={form.surface} onChange={e => setForm({ ...form, surface: Number(e.target.value) })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Régime fiscal">
              <select className={inputCls} value={form.fiscalRegime} onChange={e => setForm({ ...form, fiscalRegime: e.target.value as FiscalRegime })}>
                {REGIMES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </Field>
            <Field label="Trimestre IRL (1-4)">
              <input className={inputCls} type="number" min={1} max={4} value={form.irlQuarter} onChange={e => setForm({ ...form, irlQuarter: Number(e.target.value) })} />
            </Field>
          </div>
          <div className="flex justify-end mt-2">
            <Button onClick={save}><Check size={16} />Enregistrer</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
