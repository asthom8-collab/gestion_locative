import { useMemo, useRef, useState } from 'react'
import {
  useBankAccounts, useBankTransactions, useCreateBankAccount, useDeleteBankAccount, useImportStatement,
  useMatchTransaction, useRenameBankAccount, useSetTransactionStatus, useUnmatchTransaction,
} from '../hooks/useBank'
import { useYearRentPayments } from '../hooks/useRentPayments'
import { BankConnection } from '../components/bank/BankConnection'
import { useActionError } from '../hooks/useActionError'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Empty } from '../components/ui/Empty'
import { ErrorAlert } from '../components/ui/ErrorAlert'
import { Field, inputCls } from '../components/ui/Field'
import { Check, ChevronLeft, ChevronRight, EyeOff, Landmark, Link2, Pencil, Plus, Trash2, Undo2, Upload } from '../components/icons'
import type { BankAccount, BankAllocation, BankImportResult, BankPaymentSummary, BankSuggestion, BankTransaction } from '../types'

const eur = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { timeZone: 'UTC' })
const monthLabel = (year: number, month: number) =>
  new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const paymentLabel = (p: BankPaymentSummary) =>
  `${p.lease.tenant.firstName} ${p.lease.tenant.lastName} · ${p.lease.property.name} · ${monthLabel(p.periodYear, p.periodMonth)}`
const linkBtn = 'text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 inline-flex items-center gap-1.5 disabled:opacity-50'

type Tab = 'todo' | 'matched' | 'ignored' | 'debits'
const TABS: { id: Tab; label: string }[] = [
  { id: 'todo', label: 'À rapprocher' },
  { id: 'matched', label: 'Rapprochés' },
  { id: 'ignored', label: 'Ignorés' },
  { id: 'debits', label: 'Débits' },
]

export function Bank() {
  const { data: accounts = [], isLoading } = useBankAccounts()
  const [tab, setTab] = useState<Tab>('todo')
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [imported, setImported] = useState<BankImportResult | null>(null)
  const err = useActionError()
  const createM = useCreateBankAccount()
  const toMatch = accounts.reduce((n, a) => n + a.toMatchCount, 0)

  if (isLoading) return <div className="text-slate-400 text-sm py-8 text-center">Chargement…</div>

  return (
    <div>
      <PageHeader title="Synchro bancaire" subtitle="Import des relevés de compte et rapprochement avec les loyers" />
      <ErrorAlert message={err.error} />

      {accounts.length === 0 ? (
        <Card>
          <Empty Icon={Landmark} title="Aucun compte bancaire"
            hint="Créez le compte sur lequel arrivent les loyers, puis importez son relevé (fichier CSV téléchargé depuis votre banque)." />
          <div className="flex justify-center pb-6">
            <Button onClick={() => err.run(() => createM.mutateAsync('Compte commun'))} disabled={createM.isPending}>
              <Plus size={16} />Créer le compte
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <div className="space-y-2 mb-4">
            {accounts.map(a => <AccountCard key={a.id} account={a} onImported={setImported} />)}
          </div>
          {imported && <ImportSummary result={imported} onClose={() => setImported(null)} />}

          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div role="tablist" className="flex flex-wrap gap-1.5">
              {TABS.map(t => (
                <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                  className={`px-3 py-1.5 rounded-full text-sm border ${tab === t.id ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  {t.label}{t.id === 'todo' && toMatch > 0 && ` (${toMatch})`}
                </button>
              ))}
            </div>
            {tab !== 'todo' && (
              <div className="flex items-center gap-1">
                <button onClick={() => setYear(y => y - 1)} aria-label="Année précédente" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"><ChevronLeft size={18} /></button>
                <span className="font-semibold text-slate-900 w-14 text-center">{year}</span>
                <button onClick={() => setYear(y => y + 1)} aria-label="Année suivante" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"><ChevronRight size={18} /></button>
              </div>
            )}
          </div>
          <TransactionList tab={tab} year={year} />
          <Button variant="ghost" onClick={() => err.run(() => createM.mutateAsync('Nouveau compte'))}>
            <Plus size={15} />Ajouter un autre compte
          </Button>
        </>
      )}
    </div>
  )
}

function AccountCard({ account: a, onImported }: { account: BankAccount; onImported: (r: BankImportResult) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const err = useActionError()
  const importM = useImportStatement()
  const renameM = useRenameBankAccount()
  const deleteM = useDeleteBankAccount()
  const [renaming, setRenaming] = useState<string | null>(null)

  const onFile = async (file?: File) => {
    if (!file) return
    await err.run(async () => onImported(await importM.mutateAsync({ accountId: a.id, file })))
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <Card className="p-4">
      <ErrorAlert message={err.error} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="grid place-items-center w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 shrink-0"><Landmark size={20} /></span>
          <div className="min-w-0">
            <div className="font-medium text-slate-900 truncate">{a.name}</div>
            <div className="text-xs text-slate-500">
              {a.transactionCount} opération{a.transactionCount > 1 ? 's' : ''}
              {a.lastTransactionDate && ` · dernière le ${fmtDate(a.lastTransactionDate)}`}
              {a.toMatchCount > 0 && <span className="text-amber-700 font-medium"> · {a.toMatchCount} à rapprocher</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" aria-label={`Relevé CSV — ${a.name}`}
            onChange={e => onFile(e.target.files?.[0])} />
          <Button onClick={() => fileRef.current?.click()} disabled={importM.isPending}>
            <Upload size={16} />{importM.isPending ? 'Import…' : 'Importer un relevé'}
          </Button>
          <button onClick={() => { err.clear(); setRenaming(a.name) }} aria-label="Renommer le compte" className="p-2 rounded-lg hover:bg-slate-100 text-slate-400"><Pencil size={15} /></button>
          <button aria-label="Supprimer le compte" className="p-2 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600"
            onClick={() => confirm(`Supprimer le compte « ${a.name} » et ses opérations importées ?`) && err.run(() => deleteM.mutateAsync(a.id))}>
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      <BankConnection account={a} />
      {renaming !== null && (
        <Modal title="Renommer le compte" onClose={() => setRenaming(null)}>
          <ErrorAlert message={err.error} />
          <Field label="Nom du compte">
            <input className={inputCls} value={renaming} onChange={e => setRenaming(e.target.value)} autoFocus />
          </Field>
          <div className="flex justify-end">
            <Button disabled={!renaming.trim() || renameM.isPending}
              onClick={async () => { if (await err.run(() => renameM.mutateAsync({ id: a.id, name: renaming.trim() }))) setRenaming(null) }}>
              <Check size={16} />Enregistrer
            </Button>
          </div>
        </Modal>
      )}
    </Card>
  )
}

function ImportSummary({ result: r, onClose }: { result: BankImportResult; onClose: () => void }) {
  return (
    <div role="status" className="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
      <div>
        <div className="font-medium">
          {r.imported} opération{r.imported > 1 ? 's' : ''} importée{r.imported > 1 ? 's' : ''}
          {r.duplicates > 0 && `, ${r.duplicates} déjà présente${r.duplicates > 1 ? 's' : ''}`}
        </div>
        {r.from && r.to && <div className="text-xs mt-0.5">Relevé du {fmtDate(r.from)} au {fmtDate(r.to)}</div>}
        {r.skipped.length > 0 && (
          <div className="text-xs mt-1 text-amber-800">
            Ligne{r.skipped.length > 1 ? 's' : ''} non lue{r.skipped.length > 1 ? 's' : ''} : {r.skipped.slice(0, 8).map(s => `${s.line} (${s.reason})`).join(', ')}
            {r.skipped.length > 8 && '…'}
          </div>
        )}
      </div>
      <button onClick={onClose} className={linkBtn}>Fermer</button>
    </div>
  )
}

function TransactionList({ tab, year }: { tab: Tab; year: number }) {
  const filter =
    tab === 'todo' ? { status: 'UNMATCHED' as const, direction: 'credit' as const }
    : tab === 'matched' ? { status: 'MATCHED' as const, year }
    : tab === 'ignored' ? { status: 'IGNORED' as const, year }
    : { direction: 'debit' as const, year }
  const { data: txs = [], isLoading } = useBankTransactions(filter)
  const err = useActionError()
  const matchM = useMatchTransaction()
  const [manual, setManual] = useState<BankTransaction | null>(null)

  // Suggestions sûres (montant et libellé concordent), sans proposer deux fois la même échéance
  const sure = useMemo(() => {
    const used = new Set<string>()
    const out: { tx: BankTransaction; suggestion: BankSuggestion }[] = []
    for (const tx of txs) {
      const s = tx.suggestions?.[0]
      if (!s || s.confidence !== 'high' || s.allocations.some(a => used.has(a.rentPaymentId))) continue
      s.allocations.forEach(a => used.add(a.rentPaymentId))
      out.push({ tx, suggestion: s })
    }
    return out
  }, [txs])
  // Lignes décochées dans la liste de validation en bloc
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const selected = sure.filter(m => !excluded.has(m.tx.id))
  const toggleSure = (id: string) => setExcluded(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const validateSure = () => err.run(async () => {
    for (const { tx, suggestion } of selected) {
      await matchM.mutateAsync({ id: tx.id, allocations: suggestion.allocations.map(({ rentPaymentId, amount }) => ({ rentPaymentId, amount })) })
    }
  })

  if (isLoading) return <div className="text-slate-400 text-sm py-8 text-center">Chargement…</div>
  if (txs.length === 0) {
    const empty: Record<Tab, [string, string]> = {
      todo: ['Rien à rapprocher', 'Les encaissements des relevés importés apparaissent ici, avec les loyers qui leur correspondent.'],
      matched: [`Aucun rapprochement en ${year}`, 'Les encaissements rapprochés d’un loyer apparaissent ici.'],
      ignored: [`Aucune opération ignorée en ${year}`, 'Les virements sans rapport avec un loyer, mis de côté, apparaissent ici.'],
      debits: [`Aucun débit en ${year}`, 'Les dépenses du compte (prélèvements, factures) apparaissent ici.'],
    }
    return <Card className="mb-4"><Empty Icon={Landmark} title={empty[tab][0]} hint={empty[tab][1]} /></Card>
  }

  return (
    <div className="mb-4">
      <ErrorAlert message={err.error} />
      {tab === 'todo' && sure.length > 0 && (
        <section aria-label="Validation en bloc" className="mb-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{sure.length} encaissement{sure.length > 1 ? 's' : ''} correspond{sure.length > 1 ? 'ent' : ''} sans ambiguïté à un loyer (montant, libellé et date).</span>
            <Button onClick={validateSure} disabled={matchM.isPending || selected.length === 0}>
              <Check size={16} />{selected.length === sure.length ? 'Tout valider' : `Valider la sélection (${selected.length})`}
            </Button>
          </div>
          <ul className="mt-2 divide-y divide-indigo-100 rounded-lg border border-indigo-100 bg-white">
            {sure.map(({ tx, suggestion }) => (
              <li key={tx.id}>
                <label className="flex items-start gap-2.5 px-3 py-2 cursor-pointer">
                  <input type="checkbox" className="mt-1" checked={!excluded.has(tx.id)} onChange={() => toggleSure(tx.id)}
                    aria-label={`Valider ${tx.label} du ${fmtDate(tx.date)}`} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap justify-between gap-x-3 text-slate-800">
                      <span className="break-words">{fmtDate(tx.date)} · {tx.label}</span>
                      <span className="font-semibold text-emerald-700">+{eur(tx.amount)}</span>
                    </span>
                    {suggestion.allocations.map(a => (
                      <span key={a.rentPaymentId} className="block text-xs text-slate-500">→ {paymentLabel(a.payment)}</span>
                    ))}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="space-y-2">
        {txs.map(tx => <TransactionCard key={tx.id} tx={tx} tab={tab} onManual={() => setManual(tx)} />)}
      </div>
      {manual && <ManualMatchModal tx={manual} onClose={() => setManual(null)} />}
    </div>
  )
}

function TransactionCard({ tx, tab, onManual }: { tx: BankTransaction; tab: Tab; onManual: () => void }) {
  const err = useActionError()
  const matchM = useMatchTransaction()
  const unmatchM = useUnmatchTransaction()
  const statusM = useSetTransactionStatus()
  const busy = matchM.isPending || unmatchM.isPending || statusM.isPending
  const credit = tx.amount > 0

  const accept = (s: BankSuggestion) =>
    err.run(() => matchM.mutateAsync({ id: tx.id, allocations: s.allocations.map(({ rentPaymentId, amount }) => ({ rentPaymentId, amount })) }))

  return (
    <Card className="p-4">
      <ErrorAlert message={err.error} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-900 break-words">{tx.label}</div>
          <div className="text-xs text-slate-500">{fmtDate(tx.date)} · {tx.account.name}</div>
        </div>
        <span className={`font-semibold shrink-0 ${credit ? 'text-emerald-700' : 'text-slate-700'}`}>{credit && '+'}{eur(tx.amount)}</span>
      </div>

      {tab === 'todo' && (
        <div className="mt-3 space-y-2">
          {tx.suggestions?.length ? tx.suggestions.map((s, i) => (
            <div key={i} className={`rounded-lg border p-3 ${s.confidence === 'high' ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200'}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 text-sm">
                  {s.allocations.map(a => (
                    <div key={a.rentPaymentId} className="text-slate-800">{paymentLabel(a.payment)} <span className="text-slate-500">· {eur(a.amount)}</span></div>
                  ))}
                  <div className="text-xs text-slate-500 mt-0.5">{s.reasons.join(' · ')}</div>
                </div>
                <button className={`${linkBtn} ${s.confidence === 'high' ? 'border-emerald-300 text-emerald-800' : ''}`} disabled={busy} onClick={() => accept(s)}>
                  <Check size={14} />Valider
                </button>
              </div>
            </div>
          )) : <p className="text-xs text-slate-500">Aucun loyer ne correspond. Choisissez l’échéance à la main, ou ignorez l’opération.</p>}
          <div className="flex flex-wrap gap-2 pt-1">
            <button className={linkBtn} disabled={busy} onClick={onManual}><Link2 size={14} />Autre échéance…</button>
            <button className={linkBtn} disabled={busy} onClick={() => err.run(() => statusM.mutateAsync({ id: tx.id, status: 'IGNORED' }))}>
              <EyeOff size={14} />Ignorer
            </button>
          </div>
        </div>
      )}

      {tab === 'matched' && (
        <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
          <div className="text-sm space-y-0.5">
            {tx.rentPayments.map(p => (
              <div key={p.id} className="text-slate-700"><Check size={13} className="inline text-emerald-600 mr-1" />{paymentLabel(p)} · {eur(p.receivedAmount ?? 0)}
                {p.status === 'PARTIAL' && <span className="ml-1 text-[11px] font-medium text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">Partiel</span>}
              </div>
            ))}
          </div>
          <button className={linkBtn} disabled={busy}
            onClick={() => confirm('Défaire ce rapprochement ? Les échéances repasseront en attente et leurs quittances seront supprimées.') && err.run(() => unmatchM.mutateAsync(tx.id))}>
            <Undo2 size={14} />Défaire
          </button>
        </div>
      )}

      {tab === 'ignored' && (
        <div className="mt-3 flex justify-end">
          <button className={linkBtn} disabled={busy} onClick={() => err.run(() => statusM.mutateAsync({ id: tx.id, status: 'UNMATCHED' }))}>
            <Undo2 size={14} />Remettre à rapprocher
          </button>
        </div>
      )}
    </Card>
  )
}

/** Choix des échéances à la main : un encaissement peut en régler plusieurs, chacune pour un montant. */
function ManualMatchModal({ tx, onClose }: { tx: BankTransaction; onClose: () => void }) {
  const txYear = new Date(tx.date).getUTCFullYear()
  const { data: current = [] } = useYearRentPayments(txYear)
  const { data: previous = [] } = useYearRentPayments(txYear - 1)
  const err = useActionError()
  const matchM = useMatchTransaction()
  const [amounts, setAmounts] = useState<Record<string, string>>({})

  // Échéances pas encore rapprochées, les impayées d'abord, puis la plus proche de la date de l'opération
  const open = useMemo(() => [...current, ...previous]
    .filter(p => !p.bankTransactionId)
    .sort((a, b) => Number(a.status === 'RECEIVED') - Number(b.status === 'RECEIVED')
      || Math.abs(Date.parse(a.dueDate) - Date.parse(tx.date)) - Math.abs(Date.parse(b.dueDate) - Date.parse(tx.date)))
    .slice(0, 30), [current, previous, tx.date])

  const chosen = Object.entries(amounts).filter(([, v]) => v !== '').map(([rentPaymentId, v]) => ({ rentPaymentId, amount: Number(v.replace(',', '.')) }))
  const total = chosen.reduce((s, a) => s + a.amount, 0)
  const left = Math.round((tx.amount - total) * 100) / 100
  const valid = chosen.length > 0 && chosen.every(a => a.amount > 0) && left >= -0.005

  const toggle = (id: string, expected: number) => setAmounts(prev => {
    const next = { ...prev }
    if (id in next) delete next[id]
    else next[id] = String(Math.min(expected, Math.max(0, left)) || expected)
    return next
  })

  const save = async () => {
    if (await err.run(() => matchM.mutateAsync({ id: tx.id, allocations: chosen }))) onClose()
  }

  return (
    <Modal title={`Rapprocher ${eur(tx.amount)} du ${fmtDate(tx.date)}`} onClose={onClose} wide>
      <ErrorAlert message={err.error} />
      <p className="text-xs text-slate-500 mb-3 break-words">{tx.label}</p>
      {open.length === 0 ? (
        <p className="text-sm text-slate-500">Aucune échéance disponible en {txYear - 1} et {txYear}. Générez-les depuis la page Loyers.</p>
      ) : (
        <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg mb-3 max-h-[50vh] overflow-y-auto">
          {open.map(p => {
            const on = p.id in amounts
            return (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                <label className="flex items-center gap-2 min-w-0 text-sm cursor-pointer">
                  <input type="checkbox" checked={on} onChange={() => toggle(p.id, p.expectedAmount)} />
                  <span className="min-w-0">
                    <span className="block text-slate-800">{p.lease.tenant.firstName} {p.lease.tenant.lastName} · {p.lease.property.name}</span>
                    <span className="block text-xs text-slate-500">
                      {monthLabel(p.periodYear, p.periodMonth)} · attendu {eur(p.expectedAmount)}
                      {p.receivedAmount !== null && ` · saisi à la main ${eur(p.receivedAmount)}`}
                    </span>
                  </span>
                </label>
                {on && (
                  <input aria-label={`Montant pour ${monthLabel(p.periodYear, p.periodMonth)}`} inputMode="decimal" className={`${inputCls} w-28`}
                    value={amounts[p.id]} onChange={e => setAmounts({ ...amounts, [p.id]: e.target.value })} />
                )}
              </div>
            )
          })}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className={`text-sm ${left < -0.005 ? 'text-rose-600' : 'text-slate-500'}`}>
          {left < -0.005 ? `Dépasse le virement de ${eur(-left)}` : `Reste à affecter : ${eur(left)}`}
        </span>
        <Button onClick={save} disabled={!valid || matchM.isPending}><Check size={16} />Rapprocher</Button>
      </div>
    </Modal>
  )
}
