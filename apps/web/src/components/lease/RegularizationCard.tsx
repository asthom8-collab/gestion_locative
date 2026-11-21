import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { useRegularizationPreview, useCreateRegularization, useDeleteRegularization } from '../../hooks/useCharges'
import { useActionError } from '../../hooks/useActionError'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { ErrorAlert } from '../ui/ErrorAlert'
import { Wallet, FileText, Trash2, ChevronLeft, ChevronRight, Check } from '../icons'
import { eur, fmtDate } from '../../lib/format'
import type { LeaseDetail } from '../../types'

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const linkBtn = 'text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 inline-flex items-center gap-1.5'

/** Années couvertes par le bail, jusqu'à l'année en cours. */
export function leaseYears(lease: Pick<LeaseDetail, 'startDate' | 'endDate'>, now = new Date()) {
  const first = new Date(lease.startDate).getUTCFullYear()
  const last = Math.min(now.getFullYear(), lease.endDate ? new Date(lease.endDate).getUTCFullYear() : now.getFullYear())
  return Array.from({ length: Math.max(0, last - first + 1) }, (_, i) => first + i)
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <div className={`flex justify-between gap-3 ${strong ? 'font-semibold' : ''}`}><span>{label}</span><span className="shrink-0">{value}</span></div>
}

/** Régularisation annuelle des charges du bail : calcul, enregistrement et décompte PDF. */
export function RegularizationCard({ lease }: { lease: LeaseDetail }) {
  const years = leaseYears(lease)
  // Par défaut l'année précédente (la régularisation se fait une fois les charges de l'année connues)
  const [year, setYear] = useState(() => years.includes(new Date().getFullYear() - 1) ? new Date().getFullYear() - 1 : years[years.length - 1])
  const { data: p, error: loadError, isLoading } = useRegularizationPreview(lease.id, year)
  const createM = useCreateRegularization()
  const deleteM = useDeleteRegularization()
  const { error, run, clear } = useActionError()
  if (!years.length) return null
  const idx = years.indexOf(year)

  return (
    <Card className="p-5 mb-4">
      <div className="flex items-center justify-between mb-3 gap-3">
        <h3 className="font-semibold tracking-tight flex items-center gap-2"><Wallet size={18} className="text-indigo-600" />Régularisation des charges</h3>
        <div className="flex items-center gap-1">
          <button aria-label="Année précédente" disabled={idx <= 0} onClick={() => { clear(); setYear(years[idx - 1]) }} className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30"><ChevronLeft size={16} /></button>
          <span className="text-sm font-medium w-12 text-center">{year}</span>
          <button aria-label="Année suivante" disabled={idx >= years.length - 1} onClick={() => { clear(); setYear(years[idx + 1]) }} className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30"><ChevronRight size={16} /></button>
        </div>
      </div>
      <ErrorAlert message={error ?? (loadError instanceof Error ? loadError.message : null)} onClose={clear} />
      {isLoading || !p ? (isLoading && <p className="text-sm text-slate-400">Calcul…</p>) : p.charges.length === 0 ? (
        <p className="text-sm text-slate-500">
          Aucune charge saisie pour ce bien en {year}. <Link to={`/charges?year=${year}`} className="text-indigo-600 underline">Saisir les charges</Link>
        </p>
      ) : (
        <>
          <div className="text-sm space-y-1 rounded-lg bg-slate-50 border border-slate-200 p-3">
            <Row label={`Charges réelles du bien (${p.charges.length})`} value={eur(p.totalCharges)} />
            <Row label={`Part du locataire : ${p.occupiedDays} j sur ${p.daysInYear}`} value={eur(p.totalReal)} />
            <Row label="Provisions appelées" value={`− ${eur(p.totalCharged)}`} />
            <Row strong label={p.balance > 0 ? 'Reste à payer par le locataire' : p.balance < 0 ? 'À rembourser au locataire' : 'Solde'} value={eur(Math.abs(p.balance))} />
          </div>
          {p.missingMonths.length > 0 && (
            <p className="text-xs text-amber-700 mt-2">
              Échéances non générées ({p.missingMonths.map(m => MONTHS[m - 1]).join(', ')}) : leurs provisions ne sont pas comptées.
            </p>
          )}
          {lease.active && Math.abs(p.suggestedMonthlyCharges - lease.chargesAmount) >= 1 && (
            <p className="text-xs text-slate-500 mt-2">
              Provision mensuelle actuelle {eur(lease.chargesAmount)} ; d'après les charges {year}, elle serait de {eur(p.suggestedMonthlyCharges)} (modifiable dans le bail).
            </p>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2 mt-3">
            <Link to={`/charges?year=${year}`} className="text-xs text-indigo-600 underline mr-auto">Voir les charges {year}</Link>
            {p.existing ? (
              <>
                <span className="text-xs text-slate-500">Enregistrée le {fmtDate(p.existing.createdAt)}</span>
                <a className={linkBtn} href={api.regularizations.statementUrl(lease.id, p.existing.id)} target="_blank" rel="noreferrer"><FileText size={13} />Décompte (PDF)</a>
                <button className={linkBtn} aria-label="Supprimer la régularisation" disabled={deleteM.isPending}
                  onClick={() => confirm(`Supprimer la régularisation ${year} ? Vous pourrez la refaire.`) && run(() => deleteM.mutateAsync({ leaseId: lease.id, id: p.existing!.id }))}>
                  <Trash2 size={13} />
                </button>
              </>
            ) : (
              <Button onClick={() => run(() => createM.mutateAsync({ leaseId: lease.id, year }))} disabled={createM.isPending}><Check size={16} />Enregistrer la régularisation</Button>
            )}
          </div>
          {p.existing && (p.existing.totalReal !== p.totalReal || p.existing.totalCharged !== p.totalCharged) && (
            <p className="text-xs text-amber-700 mt-2">Les charges ou les provisions ont changé depuis l'enregistrement : supprimez puis refaites la régularisation pour la mettre à jour.</p>
          )}
        </>
      )}
    </Card>
  )
}
