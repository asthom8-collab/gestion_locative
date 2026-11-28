import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { ErrorAlert } from '../ui/ErrorAlert'
import { Field, inputCls } from '../ui/Field'
import { useProperties } from '../../hooks/useProperties'
import { useLeases } from '../../hooks/useLeases'
import { useCreateIntervention, useUpdateIntervention } from '../../hooks/useInterventions'
import { useActionError } from '../../hooks/useActionError'
import { DONE_BY, INTERVENTION_KINDS, INTERVENTION_STATUS, NATURES, PAID_BY } from '../../lib/interventions'
import { fullName } from '../../lib/format'
import type { Intervention, InterventionDoneBy, InterventionInput, InterventionKind, InterventionNature, InterventionPayer, InterventionStatus, Lease } from '../../types'

type Form = Omit<InterventionInput, 'cost' | 'providerName' | 'notes'> & { cost: string; providerName: string; notes: string }

const today = () => new Date().toISOString().slice(0, 10)

/** Bail en cours à une date (yyyy-mm-dd) sur un bien, pour le proposer par défaut. */
export function leaseAt(leases: Lease[], propertyId: string, day: string) {
  return leases.find(l => l.propertyId === propertyId && l.startDate.slice(0, 10) <= day && (!l.endDate || l.endDate.slice(0, 10) >= day)) ?? null
}

function initial(i: Intervention | undefined, defaults: { propertyId?: string; leaseId?: string }): Form {
  if (i) return {
    propertyId: i.propertyId, leaseId: i.leaseId, title: i.title, kind: i.kind, date: i.date.slice(0, 10), status: i.status,
    doneBy: i.doneBy, providerName: i.providerName ?? '', cost: String(i.cost), paidBy: i.paidBy, fiscalNature: i.fiscalNature, notes: i.notes ?? '',
  }
  return {
    propertyId: defaults.propertyId ?? '', leaseId: defaults.leaseId ?? null, title: '', kind: 'PLUMBING', date: today(), status: 'DONE',
    doneBy: 'PROFESSIONAL', providerName: '', cost: '', paidBy: 'OWNER', fiscalNature: 'MAINTENANCE', notes: '',
  }
}

/** Boutons à choix unique (plus pratiques qu'une liste sur téléphone). */
function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Record<T, string>; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="mb-3.5">
      <span className="block text-xs font-medium text-slate-600 mb-1.5">{label}</span>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(options) as T[]).map(k => (
          <button key={k} type="button" role="radio" aria-checked={value === k} onClick={() => onChange(k)}
            className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${value === k ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {options[k]}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Création ou modification d'une intervention. Le bien ne change plus une fois l'intervention créée. */
export function InterventionModal({ intervention, defaults = {}, onClose }: {
  intervention?: Intervention
  defaults?: { propertyId?: string; leaseId?: string }
  onClose: () => void
}) {
  const { data: properties = [] } = useProperties()
  const { data: leases = [] } = useLeases()
  const createM = useCreateIntervention()
  const updateM = useUpdateIntervention()
  const { error, run } = useActionError()
  const [form, setForm] = useState<Form>(() => initial(intervention, defaults))
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }))
  const propertyLeases = leases.filter(l => l.propertyId === form.propertyId)
  const pending = createM.isPending || updateM.isPending

  // Changer de bien ou de date propose le bail en cours à cette date
  const pickProperty = (propertyId: string) => setForm(f => ({ ...f, propertyId, leaseId: leaseAt(leases, propertyId, f.date)?.id ?? null }))
  const pickDate = (date: string) => setForm(f => ({ ...f, date, leaseId: intervention || !date ? f.leaseId : leaseAt(leases, f.propertyId, date)?.id ?? null }))

  const submit = async () => {
    const data: InterventionInput = {
      ...form, title: form.title.trim(), cost: Number(form.cost), date: new Date(form.date).toISOString(),
      providerName: form.doneBy === 'PROFESSIONAL' ? form.providerName.trim() || null : null, notes: form.notes.trim() || null,
    }
    const ok = await run(() => {
      if (!intervention) return createM.mutateAsync(data)
      const { propertyId: _p, ...rest } = data
      return updateM.mutateAsync({ id: intervention.id, data: rest })
    })
    if (ok) onClose()
  }
  const valid = form.propertyId && form.title.trim() && form.date && form.cost !== '' && Number(form.cost) >= 0

  return (
    <Modal title={intervention ? 'Modifier l’intervention' : 'Nouvelle intervention'} onClose={onClose} wide>
      <ErrorAlert message={error} />
      <div className="grid sm:grid-cols-2 gap-x-3">
        <Field label="Bien">
          <select className={inputCls} value={form.propertyId} disabled={!!intervention} onChange={e => pickProperty(e.target.value)}>
            <option value="">Choisir un bien…</option>
            {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Pendant le bail de (facultatif)">
          <select className={inputCls} value={form.leaseId ?? ''} disabled={!form.propertyId} onChange={e => set('leaseId', e.target.value || null)}>
            <option value="">Aucun (logement vide, parties communes…)</option>
            {propertyLeases.map(l => <option key={l.id} value={l.id}>{fullName(l.tenant)}{l.active ? '' : ' (terminé)'}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Intitulé">
        <input className={inputCls} value={form.title} maxLength={160} placeholder="Ex. remplacement du chauffe-eau" onChange={e => set('title', e.target.value)} />
      </Field>
      <Field label="Type de travaux">
        <select className={inputCls} value={form.kind} onChange={e => set('kind', e.target.value as InterventionKind)}>
          {Object.entries(INTERVENTION_KINDS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-x-3">
        <Field label="Date">
          <input type="date" className={inputCls} value={form.date} onChange={e => pickDate(e.target.value)} />
        </Field>
        <Field label={form.doneBy === 'OWNER' ? 'Coût des matériaux TTC (€)' : 'Coût TTC (€)'}>
          <input type="number" inputMode="decimal" step="0.01" min="0" className={inputCls} value={form.cost} onChange={e => set('cost', e.target.value)} />
        </Field>
      </div>
      <Choice<InterventionStatus> label="État" value={form.status} options={INTERVENTION_STATUS} onChange={v => set('status', v)} />
      <Choice<InterventionDoneBy> label="Réalisée par" value={form.doneBy} options={DONE_BY} onChange={v => set('doneBy', v)} />
      {form.doneBy === 'OWNER' ? (
        <p className="-mt-2 mb-3.5 text-xs text-slate-500">Aux impôts, seuls les matériaux comptent, sur facture : votre main-d’œuvre n’est jamais déductible.</p>
      ) : (
        <Field label="Nom du professionnel (facultatif)">
          <input className={inputCls} value={form.providerName} maxLength={160} onChange={e => set('providerName', e.target.value)} />
        </Field>
      )}
      <Choice<InterventionPayer> label="Payée par" value={form.paidBy} options={PAID_BY} onChange={v => set('paidBy', v)} />
      <Choice<InterventionNature> label="Nature fiscale" value={form.fiscalNature}
        options={Object.fromEntries(Object.entries(NATURES).map(([k, n]) => [k, n.label])) as Record<InterventionNature, string>}
        onChange={v => set('fiscalNature', v)} />
      <p className="-mt-2 mb-3.5 text-xs text-slate-500">{NATURES[form.fiscalNature].hint}</p>
      <Field label="Notes (facultatif)">
        <textarea className={inputCls} rows={2} value={form.notes} maxLength={4000} onChange={e => set('notes', e.target.value)} />
      </Field>
      <div className="flex justify-end">
        <Button onClick={submit} disabled={!valid || pending}>{pending ? 'Enregistrement…' : 'Enregistrer'}</Button>
      </div>
    </Modal>
  )
}
