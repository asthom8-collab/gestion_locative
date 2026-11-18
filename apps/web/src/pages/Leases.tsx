import { useState } from 'react'
import { useLeases, useCreateLease, useTerminateLease } from '../hooks/useLeases'
import { useProperties } from '../hooks/useProperties'
import { useTenants } from '../hooks/useTenants'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Field, inputCls } from '../components/ui/Field'
import { Empty } from '../components/ui/Empty'
import { FileSignature, Plus, ChevronRight, Check } from '../components/icons'
import type { CreateLeaseInput, LeaseType } from '../types'

const eur = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

const blank: CreateLeaseInput = { propertyId: '', tenantId: '', type: 'UNFURNISHED', startDate: new Date().toISOString().slice(0, 10), rentAmount: 0, chargesAmount: 0 }

export function Leases() {
  const { data: leases = [], isLoading } = useLeases()
  const { data: properties = [] } = useProperties()
  const { data: tenants = [] } = useTenants()
  const createM = useCreateLease()
  const terminateM = useTerminateLease()

  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<CreateLeaseInput>(blank)

  const save = async () => {
    await createM.mutateAsync({ ...form, startDate: new Date(form.startDate).toISOString() })
    setModal(false)
    setForm(blank)
  }

  const terminate = async (id: string) => {
    const endDate = prompt('Date de fin (YYYY-MM-DD) :')
    if (!endDate) return
    await terminateM.mutateAsync({ id, endDate: new Date(endDate).toISOString() })
  }

  if (isLoading) return <div className="text-slate-400 text-sm py-8 text-center">Chargement…</div>
  if (properties.length === 0 || tenants.length === 0)
    return <Card><Empty Icon={FileSignature} title="Créez d'abord un bien et un locataire" hint="Un bail relie un locataire à un bien." /></Card>

  return (
    <div>
      <PageHeader title="Mes baux" action={<Button onClick={() => { setForm(blank); setModal(true) }}><Plus size={16} />Nouveau bail</Button>} />
      {leases.length === 0 ? (
        <Card><Empty Icon={FileSignature} title="Aucun bail" /></Card>
      ) : (
        <div className="space-y-3">
          {leases.map(l => (
            <Card key={l.id} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900 truncate">{l.property?.name ?? '—'}</span>
                    <Badge ok={l.active} on="En cours" off="Terminé" />
                  </div>
                  <div className="text-sm text-slate-600 mt-0.5">
                    {l.tenant ? `${l.tenant.firstName} ${l.tenant.lastName}` : '—'}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">Depuis le {fmtDate(l.startDate)}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="font-semibold text-slate-900">{eur(l.rentAmount + l.chargesAmount)}</div>
                    {l.chargesAmount > 0 && <div className="text-xs text-slate-400">dont {eur(l.chargesAmount)} ch.</div>}
                  </div>
                  {l.active && (
                    <button onClick={() => terminate(l.id)} className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
                      Résilier
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {modal && (
        <Modal title="Nouveau bail" onClose={() => setModal(false)} wide>
          <Field label="Bien">
            <select className={inputCls} value={form.propertyId} onChange={e => setForm({ ...form, propertyId: e.target.value })}>
              <option value="">— choisir —</option>
              {properties.filter(p => !p.leases?.some(l => l.active)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Locataire">
            <select className={inputCls} value={form.tenantId} onChange={e => setForm({ ...form, tenantId: e.target.value })}>
              <option value="">— choisir —</option>
              {tenants.map(t => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <select className={inputCls} value={form.type} onChange={e => setForm({ ...form, type: e.target.value as LeaseType })}>
                <option value="UNFURNISHED">Location nue</option>
                <option value="FURNISHED">Location meublée</option>
              </select>
            </Field>
            <Field label="Début du bail">
              <input type="date" className={inputCls} value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Loyer hors charges (€)">
              <input type="number" className={inputCls} value={form.rentAmount} onChange={e => setForm({ ...form, rentAmount: Number(e.target.value) })} />
            </Field>
            <Field label="Charges (€)">
              <input type="number" className={inputCls} value={form.chargesAmount} onChange={e => setForm({ ...form, chargesAmount: Number(e.target.value) })} />
            </Field>
          </div>
          <div className="flex justify-end mt-2"><Button onClick={save}><Check size={16} />Créer le bail</Button></div>
        </Modal>
      )}
    </div>
  )
}
