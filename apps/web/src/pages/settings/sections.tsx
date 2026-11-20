import { useRef, useState } from 'react'
import { useMe, useSetSignature, useDeleteSignature } from '../../hooks/useMe'
import { useDirectory, useCreateUser, useResetPassword } from '../../hooks/useUsers'
import { useActionError } from '../../hooks/useActionError'
import { api } from '../../api/client'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Field, inputCls } from '../../components/ui/Field'
import { ErrorAlert } from '../../components/ui/ErrorAlert'
import { PasswordForm } from '../../components/auth/PasswordForm'
import { Check, PenLine, KeyRound, Users2, Upload, Trash2, Plus } from '../../components/icons'
import { fullName, initials } from '../../lib/format'
import type { CreateUserInput, DirectoryUser } from '../../types'

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
