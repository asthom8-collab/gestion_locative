import { useState } from 'react'
import { useDirectory } from '../hooks/useUsers'
import { useMe } from '../hooks/useMe'
import { useSetOwners } from '../hooks/useProperties'
import { useActionError } from '../hooks/useActionError'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { inputCls } from './ui/Field'
import { ErrorAlert } from './ui/ErrorAlert'
import { Check, X } from './icons'
import { fullName } from '../lib/format'
import type { Property } from '../types'

type Row = { userId: string; percent: number }

/** Somme des quotes-parts en pourcentage, arrondie au centième. */
export const totalPercent = (rows: Row[]) => Math.round(rows.reduce((s, r) => s + (Number(r.percent) || 0), 0) * 100) / 100

/**
 * Copropriétaires d'un bien et leurs quotes-parts (en %, total 100 %). Tous ont les mêmes droits sur le bien.
 * On ne peut pas se retirer soi-même (on perdrait l'accès au bien).
 */
export function OwnersModal({ property, onClose }: { property: Property; onClose: () => void }) {
  const { data: users = [] } = useDirectory()
  const { data: me } = useMe()
  const setM = useSetOwners()
  const { error, run } = useActionError()
  const [rows, setRows] = useState<Row[]>(() =>
    (property.ownerships ?? []).map(o => ({ userId: o.userId, percent: Math.round(o.share * 10000) / 100 })))

  const nameOf = (id: string) => {
    const u = users.find(x => x.id === id) ?? property.ownerships?.find(o => o.userId === id)?.user
    return u ? fullName(u) : '…'
  }
  const available = users.filter(u => !rows.some(r => r.userId === u.id))
  const total = totalPercent(rows)
  const valid = rows.length > 0 && total === 100 && rows.every(r => r.percent > 0)

  const add = (userId: string) => setRows([...rows, { userId, percent: 0 }])
  const share = (i: number, percent: number) => setRows(rows.map((r, j) => (j === i ? { ...r, percent } : r)))
  const equalize = () => {
    const base = Math.floor(10000 / rows.length) / 100
    setRows(rows.map((r, i) => ({ ...r, percent: i === 0 ? Math.round((100 - base * (rows.length - 1)) * 100) / 100 : base })))
  }
  const save = async () => {
    const ok = await run(() => setM.mutateAsync({ id: property.id, owners: rows.map(r => ({ userId: r.userId, share: r.percent / 100 })) }))
    if (ok) onClose()
  }

  return (
    <Modal title={`Propriétaires — ${property.name}`} onClose={onClose}>
      <ErrorAlert message={error} />
      <p className="text-sm text-slate-500 mb-4">
        Tous les propriétaires voient le bien, ses baux et ses loyers, et signent les quittances. La quote-part servira à répartir les revenus pour les impôts.
      </p>
      <div className="space-y-2 mb-3">
        {rows.map((r, i) => (
          <div key={r.userId} className="flex items-center gap-2">
            <span className="flex-1 min-w-0 text-sm font-medium text-slate-800 truncate">
              {nameOf(r.userId)}{r.userId === me?.id && <span className="text-slate-400 font-normal"> (vous)</span>}
            </span>
            <div className="relative w-28 shrink-0">
              <input type="number" min={0} max={100} step={0.01} aria-label={`Quote-part de ${nameOf(r.userId)}`}
                className={`${inputCls} pr-7 text-right`} value={r.percent} onChange={e => share(i, Number(e.target.value))} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
            </div>
            <button onClick={() => setRows(rows.filter((_, j) => j !== i))} disabled={r.userId === me?.id}
              aria-label={`Retirer ${nameOf(r.userId)}`} title={r.userId === me?.id ? 'Vous ne pouvez pas vous retirer vous-même' : 'Retirer'}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400">
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
      {available.length > 0 && (
        <select className={`${inputCls} mb-3`} value="" aria-label="Ajouter un propriétaire" onChange={e => e.target.value && add(e.target.value)}>
          <option value="">+ Ajouter un propriétaire…</option>
          {available.map(u => <option key={u.id} value={u.id}>{fullName(u)} ({u.email})</option>)}
        </select>
      )}
      {available.length === 0 && users.length <= 1 && (
        <p className="text-xs text-slate-500 mb-3">Pour ajouter un copropriétaire, l'administrateur doit d'abord lui créer un compte (Paramètres → Comptes).</p>
      )}
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm">
          Total : <span className={total === 100 ? 'font-semibold text-emerald-700' : 'font-semibold text-rose-600'}>{total} %</span>
          {rows.length > 1 && <button onClick={equalize} className="ml-3 text-xs text-indigo-600 hover:underline">Parts égales</button>}
        </div>
        <Button onClick={save} disabled={!valid || setM.isPending}><Check size={16} />Enregistrer</Button>
      </div>
    </Modal>
  )
}
