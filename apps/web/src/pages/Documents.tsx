import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useDocuments } from '../hooks/useDocuments'
import { useProperties } from '../hooks/useProperties'
import { useLeases } from '../hooks/useLeases'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Empty } from '../components/ui/Empty'
import { PropTypeIcon } from '../components/ui/PropTypeIcon'
import { ArrowLeft, ChevronRight, FileSignature, Paperclip, Upload } from '../components/icons'
import { DocumentList } from '../components/documents/DocumentList'
import { UploadDocumentModal } from '../components/documents/UploadDocumentModal'
import { DOCUMENT_CATEGORIES } from '../lib/documents'
import { fmtDate, fullName } from '../lib/format'
import type { DocumentCategory, DocumentItem, DocumentTarget, Lease, Property } from '../types'

const countLabel = (n: number) => (n === 0 ? 'Aucun document' : `${n} document${n > 1 ? 's' : ''}`)
const leaseTitle = (l: Lease) => `Bail de ${fullName(l.tenant)}`
const leasePeriod = (l: Lease) => (l.active ? `depuis le ${fmtDate(l.startDate)}` : `du ${fmtDate(l.startDate)} au ${fmtDate(l.endDate)}`)

/** Tuile cliquable (bien ou bail) avec le nombre de documents. */
function Tile({ to, icon, title, subtitle, count, muted }: {
  to: string; icon: React.ReactNode; title: string; subtitle: string; count: number; muted?: boolean
}) {
  return (
    <Link to={to} className={`flex items-center gap-3 rounded-xl border bg-white p-4 shadow-sm hover:border-indigo-300 hover:shadow transition ${muted ? 'border-slate-200 opacity-75' : 'border-slate-200'}`}>
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-slate-900 truncate">{title}</span>
        <span className="block text-xs text-slate-500 truncate">{subtitle}</span>
        <span className={`inline-block mt-1.5 text-xs font-medium rounded-full px-2 py-0.5 ${count ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
          {countLabel(count)}
        </span>
      </span>
      <ChevronRight size={18} className="text-slate-300 shrink-0" />
    </Link>
  )
}

const leaseIcon = <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg shrink-0 text-violet-600 bg-violet-50"><FileSignature size={15} /></span>

function LeaseTiles({ leases, docs }: { leases: Lease[]; docs: DocumentItem[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {leases.map(l => (
        <Tile key={l.id} to={`/documents?lease=${l.id}`} icon={leaseIcon} title={leaseTitle(l)} muted={!l.active}
          subtitle={`${l.property?.name ?? ''} · ${leasePeriod(l)}`} count={docs.filter(d => d.leaseId === l.id).length} />
      ))}
    </div>
  )
}

const sectionTitle = 'text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2 mt-6 first:mt-0'

/** Accueil : tuiles des biens d'un côté, des baux de l'autre. */
function Overview({ properties, leases, docs }: { properties: Property[]; leases: Lease[]; docs: DocumentItem[] }) {
  const active = leases.filter(l => l.active)
  const ended = leases.filter(l => !l.active)
  if (!properties.length && !leases.length)
    return <Card><Empty Icon={Paperclip} title="Aucun bien" hint="Ajoutez un bien : ses documents et ceux de ses baux se rangeront ici." /></Card>
  return (
    <div className="lg:grid lg:grid-cols-2 lg:gap-6">
      <section aria-label="Biens">
        <h3 className={sectionTitle}>Biens</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          {properties.map(p => (
            <Tile key={p.id} to={`/documents?property=${p.id}`} icon={<PropTypeIcon type={p.type} />} title={p.name}
              subtitle={p.city} count={docs.filter(d => d.propertyId === p.id).length} />
          ))}
        </div>
      </section>
      <section aria-label="Baux">
        <h3 className={`${sectionTitle} lg:mt-0`}>Baux en cours</h3>
        {active.length ? <LeaseTiles leases={active} docs={docs} /> : <p className="text-sm text-slate-500">Aucun bail en cours.</p>}
        {ended.length > 0 && (
          <>
            <h3 className={`${sectionTitle} mt-6`}>Baux terminés</h3>
            <LeaseTiles leases={ended} docs={docs} />
          </>
        )}
      </section>
    </div>
  )
}

/** Dossier d'un bien ou d'un bail : documents rangés par type, filtres par boutons, ajout rattaché. */
function Folder({ title, subtitle, target, docs, children }: {
  title: string; subtitle: string; target: DocumentTarget; docs: DocumentItem[]; children?: React.ReactNode
}) {
  const [category, setCategory] = useState<DocumentCategory | null>(null)
  const [adding, setAdding] = useState(false)
  const present = (Object.keys(DOCUMENT_CATEGORIES) as DocumentCategory[]).filter(c => docs.some(d => d.category === c))
  const shown = category && present.includes(category) ? [category] : present
  const chip = (active: boolean) => `shrink-0 text-sm px-3 py-1.5 rounded-full border transition-colors ${active
    ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`

  return (
    <div>
      <Link to="/documents" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 mb-3"><ArrowLeft size={15} />Tous les documents</Link>
      <PageHeader title={title} subtitle={subtitle} action={<Button onClick={() => setAdding(true)}><Upload size={16} />Ajouter</Button>} />

      {docs.length === 0 ? (
        <Card>
          <Empty Icon={Paperclip} title="Aucun document"
            hint={'leaseId' in target ? 'Contrat signé, états des lieux, attestation d’assurance, photos…' : 'Diagnostics, titre de propriété, taxe foncière, factures…'}
            action={{ label: 'Ajouter un document', onClick: () => setAdding(true) }} />
        </Card>
      ) : (
        <>
          {present.length > 1 && (
            <div role="group" aria-label="Filtrer par type" className="flex gap-2 overflow-x-auto pb-2 mb-2 -mx-1 px-1">
              <button className={chip(!category)} aria-pressed={!category} onClick={() => setCategory(null)}>Tous ({docs.length})</button>
              {present.map(c => (
                <button key={c} className={chip(category === c)} aria-pressed={category === c} onClick={() => setCategory(c)}>
                  {DOCUMENT_CATEGORIES[c]} ({docs.filter(d => d.category === c).length})
                </button>
              ))}
            </div>
          )}
          <div className="space-y-4">
            {shown.map(c => (
              <section key={c} aria-label={DOCUMENT_CATEGORIES[c]}>
                <h3 className="text-sm font-semibold text-slate-700 mb-1.5">{DOCUMENT_CATEGORIES[c]}</h3>
                <Card><DocumentList docs={docs.filter(d => d.category === c)} showAttachment={false} showCategory={false} /></Card>
              </section>
            ))}
          </div>
        </>
      )}
      {children}
      {adding && <UploadDocumentModal target={target} title={title} onClose={() => setAdding(false)} />}
    </div>
  )
}

export function Documents() {
  const [params] = useSearchParams()
  const propertyId = params.get('property')
  const leaseId = params.get('lease')
  const { data: docs = [], isLoading } = useDocuments()
  const { data: properties = [], isLoading: loadingProps } = useProperties()
  const { data: leases = [], isLoading: loadingLeases } = useLeases()

  if (isLoading || loadingProps || loadingLeases) return <div className="text-slate-400 text-sm py-8 text-center">Chargement…</div>

  const lease = leaseId ? leases.find(l => l.id === leaseId) : undefined
  if (lease) {
    return (
      <Folder key={lease.id} title={leaseTitle(lease)} subtitle={`${lease.property?.name ?? ''} · ${leasePeriod(lease)}`}
        target={{ leaseId: lease.id }} docs={docs.filter(d => d.leaseId === lease.id)}>
        <Link to={`/leases/${lease.id}`} className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline mt-6">Voir la fiche du bail<ChevronRight size={15} /></Link>
      </Folder>
    )
  }
  const property = propertyId ? properties.find(p => p.id === propertyId) : undefined
  if (property) {
    const propertyLeases = leases.filter(l => l.propertyId === property.id).sort((a, b) => Number(b.active) - Number(a.active))
    return (
      <Folder key={property.id} title={property.name} subtitle={`${property.address}, ${property.zipCode} ${property.city}`}
        target={{ propertyId: property.id }} docs={docs.filter(d => d.propertyId === property.id)}>
        {propertyLeases.length > 0 && (
          <section aria-label="Baux de ce bien">
            <h3 className={`${sectionTitle} mt-8`}>Baux de ce bien</h3>
            <LeaseTiles leases={propertyLeases} docs={docs} />
          </section>
        )}
      </Folder>
    )
  }

  return (
    <div>
      <PageHeader title="Documents" subtitle="Choisissez un bien ou un bail" />
      <Overview properties={properties} leases={leases} docs={docs} />
    </div>
  )
}
