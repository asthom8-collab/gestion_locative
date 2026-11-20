import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLeases, useCreateLease } from '../hooks/useLeases'
import { useProperties } from '../hooks/useProperties'
import { useTenants } from '../hooks/useTenants'
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
import { FileSignature, Plus, ChevronRight, Check } from '../components/icons'
import { eur, fmtDate, fullName, durationLabel } from '../lib/format'
import type { CreateLeaseInput, LeaseType } from '../types'

const blank = (): CreateLeaseInput => ({
  propertyId: '', tenantId: '', type: 'UNFURNISHED', startDate: new Date().toISOString().slice(0, 10),
  rentAmount: 0, chargesAmount: 0, rentDayOfMonth: 1,
})

export function Leases() {
  const { data: leases = [], isLoading } = useLeases()
  const { data: properties = [] } = useProperties()
  const { data: tenants = [] } = useTenants()
  const createM = useCreateLease()
  const modalErr = useActionError()

  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<CreateLeaseInput>(blank)

  const open = () => { modalErr.clear(); setForm(blank()); setModal(true) }
  const save = async () => {
    const ok = await modalErr.run(() => createM.mutateAsync({ ...form, startDate: new Date(form.startDate).toISOString() }))
    if (ok) setModal(false)
  }

  if (isLoading) return <div className="text-slate-400 text-sm py-8 text-center">Chargement…</div>
  if (properties.length === 0 || tenants.length === 0)
    return <Card><Empty Icon={FileSignature} title="Créez d'abord un bien et un locataire" hint="Un bail relie un locataire à un bien." /></Card>

  const propType = (id: string) => properties.find(p => p.id === id)?.type
  // Actifs d'abord, puis du plus récent au plus ancien
  const sorted = [...leases].sort((a, b) => Number(b.active) - Number(a.active) || b.startDate.localeCompare(a.startDate))
  const vacant = properties.filter(p => !p.leases?.some(l => l.active))

  return (
    <div>
      <PageHeader title="Mes baux" action={<Button onClick={open}><Plus size={16} />Nouveau bail</Button>} />
      {leases.length === 0 ? (
        <Card><Empty Icon={FileSignature} title="Aucun bail" action={{ label: 'Nouveau bail', onClick: open }} /></Card>
      ) : (
        <div className="space-y-3">
          {sorted.map(l => (
            <Link key={l.id} to={`/leases/${l.id}`} className="block">
              <Card className="p-4 hover:border-indigo-300 hover:shadow-md transition-all">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <PropTypeIcon type={propType(l.propertyId)} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900 truncate">{l.property?.name ?? 'Bien supprimé'}</span>
                        <Badge ok={l.active} on="En cours" off="Terminé" />
                      </div>
                      <div className="text-sm text-slate-600 truncate mt-0.5">{fullName(l.tenant)}</div>
                      <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span>{l.active ? `Depuis le ${fmtDate(l.startDate)}` : `${fmtDate(l.startDate)} → ${fmtDate(l.endDate)}`}</span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[11px]">{durationLabel(l.startDate, l.active ? null : l.endDate)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="font-semibold text-slate-900">{eur(l.rentAmount + l.chargesAmount)}</div>
                      {l.chargesAmount > 0 && <div className="text-xs text-slate-400">dont {eur(l.chargesAmount)} de charges</div>}
                    </div>
                    <ChevronRight size={16} className="text-slate-300" />
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {modal && (
        <Modal title="Nouveau bail" onClose={() => setModal(false)} wide>
          <ErrorAlert message={modalErr.error} />
          <div className="grid sm:grid-cols-2 gap-x-3">
            <Field label="Bien (vacants uniquement)">
              <select className={inputCls} value={form.propertyId} onChange={e => setForm({ ...form, propertyId: e.target.value })}>
                <option value="">— choisir —</option>
                {vacant.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Locataire">
              <select className={inputCls} value={form.tenantId} onChange={e => setForm({ ...form, tenantId: e.target.value })}>
                <option value="">— choisir —</option>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
              </select>
            </Field>
            <Field label="Type">
              <select className={inputCls} value={form.type} onChange={e => setForm({ ...form, type: e.target.value as LeaseType })}>
                <option value="UNFURNISHED">Location nue</option>
                <option value="FURNISHED">Location meublée</option>
              </select>
            </Field>
            <Field label="Début du bail">
              <input type="date" className={inputCls} value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
            </Field>
            <Field label="Loyer hors charges (€)">
              <input type="number" className={inputCls} value={form.rentAmount} onChange={e => setForm({ ...form, rentAmount: Number(e.target.value) })} />
            </Field>
            <Field label="Charges (€)">
              <input type="number" className={inputCls} value={form.chargesAmount} onChange={e => setForm({ ...form, chargesAmount: Number(e.target.value) })} />
            </Field>
            <Field label="Jour d'échéance du loyer (1-28)">
              <input type="number" min={1} max={28} className={inputCls} value={form.rentDayOfMonth ?? 1} onChange={e => setForm({ ...form, rentDayOfMonth: Number(e.target.value) })} />
            </Field>
          </div>
          <div className="flex justify-end mt-2"><Button onClick={save} disabled={createM.isPending}><Check size={16} />Créer le bail</Button></div>
        </Modal>
      )}
    </div>
  )
}
