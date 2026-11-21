import { useRef, useState } from 'react'
import { useMe, useSetSignature, useDeleteSignature, useUpdateMe } from '../../hooks/useMe'
import { useTestNotification } from '../../hooks/useNotifications'
import { useDirectory, useCreateUser, useResetPassword } from '../../hooks/useUsers'
import { useActionError } from '../../hooks/useActionError'
import { useIrlIndexes, useSaveIrl } from '../../hooks/useRevisions'
import { api } from '../../api/client'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Field, fieldCls, inputCls } from '../../components/ui/Field'
import { ErrorAlert } from '../../components/ui/ErrorAlert'
import { PasswordForm } from '../../components/auth/PasswordForm'
import { Check, PenLine, KeyRound, Users2, Upload, Trash2, Plus, Bell, Send } from '../../components/icons'
import { fullName, initials } from '../../lib/format'
import type { ChannelResult, CreateUserInput, DirectoryUser, NotificationTestResult, Profile, UpdateProfileInput } from '../../types'

const MAX_SIGNATURE_BYTES = 300 * 1024

const readAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result))
  reader.onerror = () => reject(new Error('Lecture du fichier impossible'))
  reader.readAsDataURL(file)
})

/** Mot de passe provisoire lisible (sans caractères ambigus), à transmettre au nouvel utilisateur. */
export function temporaryPassword(length = 12) {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const values = crypto.getRandomValues(new Uint32Array(length))
  return Array.from(values, v => chars[v % chars.length]).join('')
}

export function SignatureCard() {
  const { data: me } = useMe()
  const setM = useSetSignature()
  const deleteM = useDeleteSignature()
  const { error, run, clear } = useActionError()
  const [localError, setLocalError] = useState<string | null>(null)
  const [version, setVersion] = useState(() => Date.now()) // force le rechargement de l'aperçu
  const input = useRef<HTMLInputElement>(null)

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    clear()
    if (!['image/png', 'image/jpeg'].includes(file.type)) return setLocalError('Choisissez une image PNG ou JPEG')
    if (file.size > MAX_SIGNATURE_BYTES) return setLocalError('Image trop lourde (300 Ko au plus)')
    setLocalError(null)
    if (await run(async () => setM.mutateAsync(await readAsDataUrl(file)))) setVersion(Date.now())
  }

  return (
    <Card className="p-5">
      <h3 className="font-semibold text-slate-900 mb-1 flex items-center gap-2"><PenLine size={17} className="text-indigo-600" />Signature</h3>
      <p className="text-sm text-slate-500 mb-4">
        Image de votre signature (PNG ou JPEG, fond blanc ou transparent), apposée sous votre nom sur les quittances.
        Chaque copropriétaire enregistre la sienne. Les quittances déjà établies ne changent pas : établissez-les à nouveau si besoin.
      </p>
      <ErrorAlert message={localError ?? error} />
      {me?.hasSignature ? (
        <div className="flex items-center gap-4 flex-wrap">
          <div className="border border-slate-200 rounded-lg bg-white p-2">
            <img src={`${api.me.signatureUrl}?v=${version}`} alt="Votre signature" className="h-16 max-w-[220px] object-contain" />
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => input.current?.click()} disabled={setM.isPending}><Upload size={15} />Remplacer</Button>
            <Button variant="danger" onClick={() => run(() => deleteM.mutateAsync())} disabled={deleteM.isPending}><Trash2 size={15} />Supprimer</Button>
          </div>
        </div>
      ) : (
        <Button variant="ghost" onClick={() => input.current?.click()} disabled={setM.isPending}><Upload size={15} />Ajouter une image de signature</Button>
      )}
      <input ref={input} type="file" accept="image/png,image/jpeg" className="hidden" aria-label="Fichier de signature" onChange={onFile} />
    </Card>
  )
}

export function PasswordCard() {
  return (
    <Card className="p-5">
      <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><KeyRound size={17} className="text-indigo-600" />Mot de passe</h3>
      <PasswordForm />
      <p className="text-xs text-slate-400 mt-3">Changer de mot de passe ferme vos sessions ouvertes sur les autres appareils.</p>
    </Card>
  )
}

/** Administrateur : comptes des copropriétaires (création, mot de passe provisoire). */
export function AccountsCard() {
  const { data: users = [] } = useDirectory()
  const { data: me } = useMe()
  const createM = useCreateUser()
  const resetM = useResetPassword()
  const modalErr = useActionError()
  const [creating, setCreating] = useState<CreateUserInput | null>(null)
  const [resetting, setResetting] = useState<{ user: DirectoryUser; password: string } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const openCreate = () => { modalErr.clear(); setCreating({ email: '', firstName: '', lastName: '', password: temporaryPassword() }) }
  const saveCreate = async () => {
    if (!creating) return
    if (await modalErr.run(() => createM.mutateAsync(creating))) {
      setNotice(`Compte créé pour ${creating.firstName} ${creating.lastName}. Transmettez-lui son e-mail et le mot de passe provisoire « ${creating.password} » : il devra le changer à la première connexion.`)
      setCreating(null)
    }
  }
  const saveReset = async () => {
    if (!resetting) return
    if (await modalErr.run(() => resetM.mutateAsync({ id: resetting.user.id, password: resetting.password }))) {
      setNotice(`Mot de passe de ${fullName(resetting.user)} réinitialisé : « ${resetting.password} » (provisoire, à changer à la connexion).`)
      setResetting(null)
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-1 gap-3">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2"><Users2 size={17} className="text-indigo-600" />Comptes</h3>
        <Button variant="ghost" onClick={openCreate}><Plus size={15} />Nouveau compte</Button>
      </div>
      <p className="text-sm text-slate-500 mb-4">Chaque copropriétaire a son propre compte et ne voit que les biens dont il est propriétaire.</p>
      {notice && (
        <div role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>
      )}
      <div className="divide-y divide-slate-100">
        {users.map(u => (
          <div key={u.id} className="flex items-center justify-between py-2.5 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="grid place-items-center w-8 h-8 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold shrink-0">{initials(u)}</div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-800 truncate">{fullName(u)}{u.id === me?.id && <span className="text-slate-400 font-normal"> (vous)</span>}</div>
                <div className="text-xs text-slate-500 truncate">{u.email}</div>
              </div>
            </div>
            {u.id !== me?.id && (
              <button className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 shrink-0"
                onClick={() => { modalErr.clear(); setResetting({ user: u, password: temporaryPassword() }) }}>
                Réinitialiser le mot de passe
              </button>
            )}
          </div>
        ))}
      </div>

      {creating && (
        <Modal title="Nouveau compte" onClose={() => setCreating(null)}>
          <ErrorAlert message={modalErr.error} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prénom"><input className={inputCls} value={creating.firstName} onChange={e => setCreating({ ...creating, firstName: e.target.value })} /></Field>
            <Field label="Nom"><input className={inputCls} value={creating.lastName} onChange={e => setCreating({ ...creating, lastName: e.target.value })} /></Field>
          </div>
          <Field label="E-mail (identifiant de connexion)"><input className={inputCls} type="email" value={creating.email} onChange={e => setCreating({ ...creating, email: e.target.value })} /></Field>
          <Field label="Mot de passe provisoire"><input className={inputCls} value={creating.password} onChange={e => setCreating({ ...creating, password: e.target.value })} /></Field>
          <div className="flex justify-end"><Button onClick={saveCreate} disabled={createM.isPending}><Check size={16} />Créer le compte</Button></div>
        </Modal>
      )}
      {resetting && (
        <Modal title={`Réinitialiser le mot de passe de ${fullName(resetting.user)}`} onClose={() => setResetting(null)}>
          <ErrorAlert message={modalErr.error} />
          <Field label="Nouveau mot de passe provisoire"><input className={inputCls} value={resetting.password} onChange={e => setResetting({ ...resetting, password: e.target.value })} /></Field>
          <p className="text-xs text-slate-500 -mt-1 mb-3">Ses sessions ouvertes seront fermées, et il devra choisir un nouveau mot de passe à la connexion.</p>
          <div className="flex justify-end"><Button onClick={saveReset} disabled={resetM.isPending}><Check size={16} />Réinitialiser</Button></div>
        </Modal>
      )}
    </Card>
  )
}

/** Indices de référence des loyers (INSEE), saisis à la main et communs à tous les comptes. */
export function IrlCard() {
  const { data: indexes = [] } = useIrlIndexes()
  const saveM = useSaveIrl()
  const { error, run, clear } = useActionError()
  const now = new Date()
  const [form, setForm] = useState({ quarter: 2, year: now.getFullYear(), value: '' })
  const save = async () => {
    if (await run(() => saveM.mutateAsync({ quarter: form.quarter, year: form.year, value: Number(form.value) }))) setForm({ ...form, value: '' })
  }
  return (
    <Card className="p-5">
      <h3 className="font-semibold tracking-tight mb-1">Indices de référence des loyers (IRL)</h3>
      <p className="text-xs text-slate-500 mb-3">Valeurs publiées par l'INSEE chaque trimestre, utilisées pour réviser les loyers. Saisir à nouveau un trimestre corrige sa valeur.</p>
      <ErrorAlert message={error} onClose={clear} />
      <div className="flex flex-wrap gap-2 items-end mb-3">
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
      {indexes.length === 0 ? <p className="text-sm text-slate-400">Aucun indice saisi.</p> : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
          {indexes.map(i => (
            <div key={i.id} className="rounded-lg border border-slate-200 px-3 py-2 flex justify-between">
              <span className="text-slate-500">T{i.quarter} {i.year}</span>
              <span className="font-medium">{i.value.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

const channelText = (r: ChannelResult, notConfigured: string) =>
  r === 'sent' ? 'envoyé' : r === 'disabled' ? 'désactivé' : r === 'not_configured' ? notConfigured : `échec (${r.error})`

/**
 * Notifications : délai avant l'anniversaire des baux, e-mail, téléphone (application ntfy ou SMS Free Mobile).
 * La clé Free Mobile n'est jamais renvoyée par l'API : champ vide = on garde celle enregistrée.
 */
export function NotificationsCard() {
  const { data: me } = useMe()
  return me ? <NotificationsForm me={me} /> : null
}

function NotificationsForm({ me }: { me: Profile }) {
  const updateM = useUpdateMe()
  const testM = useTestNotification()
  const { error, run, clear } = useActionError()
  const [form, setForm] = useState({
    notifyDaysBefore: String(me.notifyDaysBefore), notifyEmail: me.notifyEmail,
    ntfyTopic: me.ntfyTopic ?? '', freeMobileUser: me.freeMobileUser ?? '', freeMobileKey: '',
  })
  const [saved, setSaved] = useState(false)
  const [test, setTest] = useState<NotificationTestResult | null>(null)
  const set = (patch: Partial<typeof form>) => { setForm({ ...form, ...patch }); setSaved(false) }
  const days = Number(form.notifyDaysBefore)
  const validDays = Number.isInteger(days) && days >= 1 && days <= 180
  const save = async (extra: UpdateProfileInput = {}) => {
    const data: UpdateProfileInput = {
      notifyDaysBefore: days, notifyEmail: form.notifyEmail, ntfyTopic: form.ntfyTopic.trim(), freeMobileUser: form.freeMobileUser.trim(),
      ...(form.freeMobileKey ? { freeMobileKey: form.freeMobileKey.trim() } : {}), ...extra,
    }
    if (await run(() => updateM.mutateAsync(data))) { setSaved(true); setForm(f => ({ ...f, freeMobileKey: '' })) }
  }
  const sendTest = async () => {
    setTest(null)
    await run(async () => setTest(await testM.mutateAsync() as NotificationTestResult))
  }

  return (
    <Card className="p-5">
      <h3 className="font-semibold tracking-tight mb-1 flex items-center gap-2"><Bell size={16} />Notifications</h3>
      <p className="text-xs text-slate-500 mb-4">
        Avant la date anniversaire de chaque bail, un rappel arrive dans l'application (cloche) et sur les canaux choisis ici,
        avec le loyer révisé et votre quote-part, pour préparer le courrier au locataire. Chaque copropriétaire règle ses propres canaux.
      </p>
      <ErrorAlert message={error} onClose={clear} />
      <div className="space-y-4">
        <Field label="Prévenir combien de jours avant l'anniversaire du bail">
          <input type="number" min={1} max={180} className={`${fieldCls} w-28`} value={form.notifyDaysBefore} onChange={e => set({ notifyDaysBefore: e.target.value })} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={form.notifyEmail} onChange={e => set({ notifyEmail: e.target.checked })} />
          Recevoir aussi un e-mail ({me.email})
        </label>
        <Field label="Téléphone : sujet ntfy">
          <input className={inputCls} placeholder="ex. gestion-locative-7k2p9x" value={form.ntfyTopic} onChange={e => set({ ntfyTopic: e.target.value })} />
        </Field>
        <p className="text-xs text-slate-500 -mt-2">
          Installez l'application gratuite <strong>ntfy</strong> (App Store ou Google Play), abonnez-vous à un sujet difficile à deviner
          (n'importe qui connaissant le sujet peut lire les messages), puis saisissez le même sujet ici.
          Fonctionne avec tous les opérateurs : c'est le canal à choisir si vous n'êtes pas chez Free.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Téléphone : SMS Free Mobile (identifiant)">
            <input className={inputCls} placeholder="identifiant Free Mobile" value={form.freeMobileUser} onChange={e => set({ freeMobileUser: e.target.value })} />
          </Field>
          <Field label="Clé d'identification">
            <input type="password" autoComplete="off" className={inputCls} value={form.freeMobileKey} onChange={e => set({ freeMobileKey: e.target.value })}
              placeholder={me.hasFreeMobileKey ? 'enregistrée (laisser vide pour la garder)' : 'clé de l’option SMS'} />
          </Field>
        </div>
        <p className="text-xs text-slate-500 -mt-2">
          Réservé aux abonnés Free Mobile : activez l'option gratuite « Notifications par SMS » dans l'espace abonné (Mes options), qui donne la clé.
          {me.hasFreeMobileKey && <> <button className="text-rose-600 underline" onClick={() => save({ freeMobileKey: '' })}>Supprimer la clé</button></>}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-4">
        <Button onClick={() => save()} disabled={!validDays || updateM.isPending}><Check size={16} />Enregistrer les notifications</Button>
        <Button variant="ghost" onClick={sendTest} disabled={testM.isPending}><Send size={16} />Envoyer un essai</Button>
        {saved && <span className="text-sm text-emerald-700">Enregistré</span>}
      </div>
      {test && (
        <ul className="text-sm text-slate-600 mt-3 space-y-0.5" aria-label="Résultat de l’essai">
          <li>Application : envoyé (voir la cloche)</li>
          <li>E-mail : {channelText(test.email, 'serveur d’e-mail (SMTP) non configuré sur le serveur')}</li>
          <li>ntfy : {channelText(test.ntfy, 'pas de sujet')}</li>
          <li>SMS : {channelText(test.sms, 'identifiant ou clé manquants')}</li>
        </ul>
      )}
    </Card>
  )
}
