import { useEffect, useMemo, useState } from 'react'
import {
  useBankBanks, useChooseRemoteAccount, useCompleteConnection, useConnectBank, useDisconnectBank, useSyncBank,
} from '../../hooks/useBank'
import { useActionError } from '../../hooks/useActionError'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { ErrorAlert } from '../ui/ErrorAlert'
import { inputCls } from '../ui/Field'
import { AlertCircle, Check, Landmark, Link2, RefreshCw, X } from '../icons'
import type { BankAccount, BankSyncResult } from '../../types'

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR')
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const daysUntil = (iso: string) => Math.ceil((Date.parse(iso) - Date.now()) / 86_400_000)
const linkBtn = 'text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 inline-flex items-center gap-1.5 disabled:opacity-50'

/**
 * Connexion automatique d'un compte à la banque (Enable Banking) : choix de la banque, accord sur son site,
 * adresse de retour recopiée (ou reçue directement), choix du compte, puis synchronisation.
 */
export function BankConnection({ account: a }: { account: BankAccount }) {
  const { data } = useBankBanks()
  const err = useActionError()
  const [choosing, setChoosing] = useState(false)
  const [bankUrl, setBankUrl] = useState<string | null>(null)
  const [returnUrl, setReturnUrl] = useState('')
  const [synced, setSynced] = useState<BankSyncResult | null>(null)
  const completeM = useCompleteConnection()
  const chooseM = useChooseRemoteAccount()
  const syncM = useSyncBank()
  const disconnectM = useDisconnectBank()

  // Retour direct de la banque sur cette page (adresse de retour en https) : on termine sans copier-coller
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (!a.connectionPending || !params.get('state') || !(params.get('code') || params.get('error'))) return
    const url = window.location.href
    window.history.replaceState(null, '', window.location.pathname)
    err.run(() => completeM.mutateAsync({ accountId: a.id, returnUrl: url }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.connectionPending, a.id])

  if (!data?.configured) return null

  const complete = async () => {
    if (await err.run(() => completeM.mutateAsync({ accountId: a.id, returnUrl }))) { setReturnUrl(''); setBankUrl(null) }
  }
  const sync = () => err.run(async () => setSynced(await syncM.mutateAsync(a.id)))
  const expiresIn = a.consentExpiresAt ? daysUntil(a.consentExpiresAt) : null
  const expired = expiresIn !== null && expiresIn <= 0

  return (
    <div className="mt-3 pt-3 border-t border-slate-100 text-sm">
      <ErrorAlert message={err.error} />

      {a.accountChoices ? (
        <div>
          <p className="text-slate-700 mb-2">La banque autorise plusieurs comptes : lequel reçoit les loyers ?</p>
          <div className="flex flex-wrap gap-2">
            {a.accountChoices.map(c => (
              <button key={c.uid} className={linkBtn} disabled={chooseM.isPending}
                onClick={() => err.run(() => chooseM.mutateAsync({ accountId: a.id, uid: c.uid }))}>
                <Landmark size={14} />{c.label}
              </button>
            ))}
          </div>
        </div>
      ) : a.connectionPending ? (
        <div className="space-y-2">
          <p className="text-slate-700">
            <span className="font-medium">Connexion en cours avec {a.bankName}.</span>{' '}
            {bankUrl && <><a href={bankUrl} target="_blank" rel="noreferrer" className="text-indigo-600 underline">Ouvrir le site de la banque</a>, donnez votre accord, puis </>}
            {!bankUrl && 'Après votre accord sur le site de la banque, '}
            recopiez ici l’adresse de la page où la banque vous renvoie (elle commence par https://localhost… et peut afficher une erreur : c’est normal).
          </p>
          <div className="flex flex-wrap gap-2">
            <input aria-label="Adresse de retour de la banque" className={`${inputCls} flex-1 min-w-[14rem]`} placeholder="https://localhost:5176/bank?state=…&code=…"
              value={returnUrl} onChange={e => setReturnUrl(e.target.value)} />
            <Button onClick={complete} disabled={!returnUrl.trim() || completeM.isPending}><Check size={16} />Terminer la connexion</Button>
          </div>
          <button className={linkBtn} onClick={() => setChoosing(true)}>Recommencer avec une autre banque</button>
        </div>
      ) : a.connected ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-slate-700 flex items-center gap-1.5"><Link2 size={14} className="text-emerald-600" />Relié à {a.bankName}{a.remoteLabel && ` · ${a.remoteLabel}`}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {a.lastSyncAt ? `Dernière synchronisation le ${fmtDateTime(a.lastSyncAt)}` : 'Pas encore synchronisé'}
              {' · relevé automatique deux fois par jour'}
            </div>
            {a.consentExpiresAt && (
              <div className={`text-xs mt-0.5 ${expired ? 'text-rose-600 font-medium' : expiresIn! <= 14 ? 'text-amber-700 font-medium' : 'text-slate-500'}`}>
                {expired ? `Accord de la banque expiré le ${fmtDate(a.consentExpiresAt)} : renouvelez-le.` : `Accord de la banque valable jusqu’au ${fmtDate(a.consentExpiresAt)}${expiresIn! <= 14 ? ` (dans ${expiresIn} jour${expiresIn! > 1 ? 's' : ''})` : ''}`}
              </div>
            )}
            {a.lastSyncError && <div className="text-xs mt-0.5 text-rose-600 flex items-start gap-1"><AlertCircle size={13} className="mt-0.5 shrink-0" />{a.lastSyncError}</div>}
            {synced && <div role="status" className="text-xs mt-0.5 text-emerald-700">{synced.imported} nouvelle{synced.imported > 1 ? 's' : ''} opération{synced.imported > 1 ? 's' : ''} reçue{synced.imported > 1 ? 's' : ''}</div>}
          </div>
          <div className="flex flex-wrap gap-2">
            {(expired || (expiresIn !== null && expiresIn <= 14)) && (
              <button className={linkBtn} onClick={() => setChoosing(true)}><RefreshCw size={14} />Renouveler l’accord</button>
            )}
            <button className={linkBtn} disabled={syncM.isPending || expired} onClick={sync}>
              <RefreshCw size={14} />{syncM.isPending ? 'Synchronisation…' : 'Synchroniser'}
            </button>
            <button className={linkBtn} disabled={disconnectM.isPending}
              onClick={() => confirm('Déconnecter ce compte de la banque ? Les opérations déjà reçues restent.') && err.run(() => disconnectM.mutateAsync(a.id))}>
              <X size={14} />Déconnecter
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-slate-500">Reliez le compte à la banque pour recevoir les opérations sans import de fichier.</span>
          <button className={linkBtn} onClick={() => setChoosing(true)}><Link2 size={14} />Connecter la banque</button>
        </div>
      )}

      {choosing && (
        <BankPicker account={a} banks={data.banks}
          onClose={() => setChoosing(false)} onStarted={url => { setChoosing(false); setBankUrl(url); window.open(url, '_blank', 'noopener') }} />
      )}
    </div>
  )
}

/** Choix de la banque : recherche et boutons (pas de liste déroulante). */
function BankPicker({ account, banks, onClose, onStarted }: {
  account: BankAccount; banks: { name: string; beta: boolean }[]; onClose: () => void; onStarted: (url: string) => void
}) {
  const accountId = account.id
  const [search, setSearch] = useState(account.bankName ?? '')
  // 1re connexion d'un compte qui a déjà des opérations : la synchronisation reprendra après la dernière
  const existing = !account.lastSyncAt && account.transactionCount > 0 && account.lastTransactionDate
  const err = useActionError()
  const connectM = useConnectBank()
  const shown = useMemo(() => {
    const q = search.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
    return banks.filter(b => b.name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(q)).slice(0, 40)
  }, [banks, search])

  const pick = (bankName: string) => err.run(async () => onStarted((await connectM.mutateAsync({ accountId, bankName })).url))

  return (
    <Modal title="Connecter la banque" onClose={onClose}>
      <ErrorAlert message={err.error} />
      {existing && (
        <div role="note" className="mb-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>
            Ce compte contient déjà {account.transactionCount} opération{account.transactionCount > 1 ? 's' : ''} (la dernière
            le {fmtDate(account.lastTransactionDate!)}) : la banque ne transmettra que les opérations suivantes, pour éviter les
            doublons. Si elles viennent d’une autre banque ou d’un autre compte, créez plutôt un compte à part pour cette connexion.
          </span>
        </div>
      )}
      <input aria-label="Rechercher une banque" className={`${inputCls} mb-3`} value={search} onChange={e => setSearch(e.target.value)} autoFocus />
      <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
        {shown.map(b => (
          <button key={b.name} disabled={connectM.isPending} onClick={() => pick(b.name)}
            className="w-full text-left px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm flex items-center justify-between gap-2 disabled:opacity-50">
            <span className="flex items-center gap-2"><Landmark size={14} className="text-slate-400" />{b.name}</span>
            {b.beta && <span className="text-[10px] text-slate-400">bêta</span>}
          </button>
        ))}
        {shown.length === 0 && <p className="text-sm text-slate-500">Aucune banque ne correspond.</p>}
      </div>
      <p className="text-xs text-slate-500 mt-3">Le site de la banque s’ouvre dans un nouvel onglet. L’accord est valable jusqu’à 180 jours ; l’application ne peut que lire les opérations.</p>
    </Modal>
  )
}
