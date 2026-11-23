import { useState } from 'react'
import { useIrlIndexes, useIrlSync, useSaveIrl, useSyncIrl } from '../hooks/useRevisions'
import { useActionError } from '../hooks/useActionError'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { fieldCls } from '../components/ui/Field'
import { ErrorAlert } from '../components/ui/ErrorAlert'
import { RefreshCw, TrendingUp } from '../components/icons'
import { fmtDate } from '../lib/format'
import type { IrlIndex, IrlSyncResult } from '../types'

const num = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dateTime = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

/** Variation sur un an (même trimestre de l'année précédente), en %. */
function yearlyChange(i: IrlIndex, all: IrlIndex[]) {
  const prev = all.find(x => x.quarter === i.quarter && x.year === i.year - 1)
  return prev ? Math.round((i.value / prev.value - 1) * 10000) / 100 : null
}

function syncText(s: IrlSyncResult) {
  if (s.error) return `Dernière vérification le ${dateTime(s.checkedAt)} : échec (${s.error}).`
  const news = s.added || s.corrected
    ? ` ${s.added} indice${s.added > 1 ? 's' : ''} ajouté${s.added > 1 ? 's' : ''}${s.corrected ? `, ${s.corrected} corrigé${s.corrected > 1 ? 's' : ''}` : ''}.`
    : ' Rien de nouveau.'
  return `Dernière vérification le ${dateTime(s.checkedAt)}${s.latest ? ` (dernier indice publié : T${s.latest.quarter} ${s.latest.year})` : ''}.${news}`
}

/** Saisie à la main d'un indice (si l'INSEE n'est pas joignable) ; ressaisir un trimestre corrige sa valeur. */
function ManualEntry() {
  const saveM = useSaveIrl()
  const { error, run, clear } = useActionError()
  const [form, setForm] = useState({ quarter: 2, year: new Date().getFullYear(), value: '' })
  const save = async () => {
    if (await run(() => saveM.mutateAsync({ quarter: form.quarter, year: form.year, value: Number(form.value) }))) setForm({ ...form, value: '' })
  }
  return (
    <details className="mt-4 rounded-lg border border-slate-200 p-3">
      <summary className="text-sm font-medium text-slate-700 cursor-pointer">Saisir un indice à la main</summary>
      <ErrorAlert message={error} onClose={clear} />
      <div className="flex flex-wrap gap-2 items-end mt-3">
        <label className="text-xs text-slate-500">Trimestre
          <select aria-label="Trimestre" className={`${fieldCls} mt-1 block`} value={form.quarter} onChange={e => setForm({ ...form, quarter: Number(e.target.value) })}>
            {[1, 2, 3, 4].map(q => <option key={q} value={q}>T{q}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-500">Année
          <input aria-label="Année" type="number" className={`${fieldCls} mt-1 w-24`} value={form.year} onChange={e => setForm({ ...form, year: Number(e.target.value) })} />
        </label>
        <label className="text-xs text-slate-500">Valeur
          <input aria-label="Valeur" type="number" step="0.01" className={`${fieldCls} mt-1 w-28`} value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} />
        </label>
        <Button onClick={save} disabled={!form.value || saveM.isPending}>Enregistrer</Button>
      </div>
    </details>
  )
}

/**
 * Référentiel des indices de référence des loyers (IRL), communs à tous les comptes : importés chaque jour depuis
 * l'INSEE par l'API, avec vérification à la demande et saisie manuelle de secours.
 */
export function Indices() {
  const { data: indexes = [], isLoading } = useIrlIndexes()
  const { data: lastSync } = useIrlSync()
  const syncM = useSyncIrl()
  const { error, run, clear } = useActionError()
  const shown = syncM.data ?? lastSync

  return (
    <div>
      <PageHeader title="Indices IRL" subtitle="Indice de référence des loyers publié par l'INSEE, utilisé pour réviser les loyers" />
      <div className="max-w-3xl">
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
            <p className="text-sm text-slate-600 flex-1 min-w-[14rem]">
              Les indices sont importés automatiquement depuis l'INSEE une fois par jour (publication chaque trimestre,
              mi-janvier, mi-avril, mi-juillet et mi-octobre).
            </p>
            <Button variant="ghost" onClick={() => run(() => syncM.mutateAsync())} disabled={syncM.isPending}>
              <RefreshCw size={15} className={syncM.isPending ? 'animate-spin' : ''} />Vérifier maintenant
            </Button>
          </div>
          {shown && <p role="status" className={`text-xs mb-3 ${shown.error ? 'text-rose-600' : 'text-slate-500'}`}>{syncText(shown)}</p>}
          <ErrorAlert message={error} onClose={clear} />

          {isLoading ? <p className="text-sm text-slate-400">Chargement…</p> : indexes.length === 0 ? (
            <p className="text-sm text-slate-400">Aucun indice : cliquez sur « Vérifier maintenant ».</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-4 font-medium">Trimestre</th>
                  <th className="py-2 pr-4 font-medium text-right">Valeur</th>
                  <th className="py-2 pr-4 font-medium text-right">Sur un an</th>
                  <th className="py-2 font-medium hidden sm:table-cell">Publication</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {indexes.map(i => {
                  const change = yearlyChange(i, indexes)
                  return (
                    <tr key={i.id}>
                      <td className="py-2.5 pr-4 font-medium text-slate-700 whitespace-nowrap">T{i.quarter} {i.year}</td>
                      <td className="py-2.5 pr-4 text-right font-semibold tabular-nums">{num(i.value)}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-slate-600 whitespace-nowrap">
                        {change == null ? '—' : <span className="inline-flex items-center gap-1"><TrendingUp size={13} className="text-slate-400" />{change > 0 ? '+' : ''}{num(change)} %</span>}
                      </td>
                      <td className="py-2.5 text-xs text-slate-500 hidden sm:table-cell">
                        {i.source === 'INSEE'
                          ? <>INSEE{i.publishedAt && `, JO du ${fmtDate(i.publishedAt)}`}</>
                          : <span className="text-amber-700">Saisi à la main</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          <ManualEntry />
        </Card>
      </div>
    </div>
  )
}
