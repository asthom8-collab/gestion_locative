export type PropertyType = 'APARTMENT' | 'HOUSE' | 'PARKING' | 'COMMERCIAL'
export type FiscalRegime = 'NU' | 'PINEL' | 'LMNP_MICRO' | 'LMNP_REEL'
export type LeaseType = 'UNFURNISHED' | 'FURNISHED'

export interface User {
  id: string
  firstName: string
  lastName: string
}

export interface Ownership {
  id: string
  userId: string
  share: number
  /** Période de détention (bornes incluses), null = depuis toujours / encore propriétaire */
  startDate: string | null
  endDate: string | null
  user: Pick<User, 'id' | 'firstName' | 'lastName'>
}

export interface Property {
  id: string
  name: string
  address: string
  zipCode: string
  city: string
  type: PropertyType
  surface: number
  fiscalRegime: FiscalRegime
  irlQuarter: number
  createdAt: string
  ownerships: Ownership[]
  leases: Lease[]
}

export interface Tenant {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string | null
  iban?: string | null
  createdAt: string
  leases: Lease[]
}

export interface Lease {
  id: string
  propertyId: string
  tenantId: string
  type: LeaseType
  startDate: string
  endDate?: string | null
  rentAmount: number
  chargesAmount: number
  rentDayOfMonth: number
  irlReference?: number
  irlQuarter?: number
  irlYear?: number
  /** Texte attendu dans le libellé du virement (rapprochement bancaire) */
  bankLabel?: string | null
  active: boolean
  createdAt: string
  property?: Pick<Property, 'id' | 'name' | 'address' | 'city'>
  tenant?: Pick<Tenant, 'id' | 'firstName' | 'lastName' | 'email'>
  /** Dernière révision IRL (liste des baux uniquement) */
  rentRevisions?: { effectiveDate: string }[]
}

/** Réponse de GET /api/leases/:id : bien et locataire complets. */
export interface LeaseDetail extends Omit<Lease, 'property' | 'tenant'> {
  property: Omit<Property, 'ownerships' | 'leases'>
  tenant: Omit<Tenant, 'leases'>
}

export interface CreatePropertyInput {
  name: string
  address: string
  zipCode: string
  city: string
  type: PropertyType
  surface: number
  fiscalRegime: FiscalRegime
  irlQuarter: number
}

export interface CreateTenantInput {
  firstName: string
  lastName: string
  email: string
  phone?: string | null
  iban?: string | null
}

export interface CreateLeaseInput {
  propertyId: string
  tenantId: string
  type: LeaseType
  startDate: string
  rentAmount: number
  chargesAmount: number
  rentDayOfMonth?: number
  irlReference?: number
  irlQuarter?: number
  irlYear?: number
}

/** PATCH /api/leases/:id : le bien et le locataire ne changent pas. */
export type UpdateLeaseInput = Partial<Pick<CreateLeaseInput, 'type' | 'rentAmount' | 'chargesAmount' | 'rentDayOfMonth' | 'irlReference' | 'irlQuarter' | 'irlYear'>> & { bankLabel?: string | null }

export type PaymentStatus = 'PENDING' | 'RECEIVED' | 'PARTIAL' | 'LATE'

export interface Receipt {
  id: string
  rentPaymentId: string
  filePath: string
  sentAt: string | null
  createdAt: string
}

export interface RentPayment {
  id: string
  leaseId: string
  periodMonth: number
  periodYear: number
  periodStart: string
  periodEnd: string
  rentAmount: number
  chargesAmount: number
  expectedAmount: number
  receivedAmount: number | null
  paymentDate: string | null
  status: PaymentStatus
  dueDate: string
  /** MANUAL : saisi à la main ; BANK_MATCH : rapproché d'une opération bancaire */
  source: 'MANUAL' | 'BANK_MATCH'
  bankTransactionId: string | null
  receipt: Receipt | null
  lease: {
    id: string
    rentDayOfMonth: number
    property: Pick<Property, 'id' | 'name' | 'address' | 'city'>
    tenant: Pick<Tenant, 'id' | 'firstName' | 'lastName' | 'email'>
  }
}

export interface Profile {
  id: string
  email: string
  firstName: string
  lastName: string
  role: 'ADMIN' | 'USER'
  address: string | null
  zipCode: string | null
  city: string | null
  /** Compte créé par l'administrateur : changer le mot de passe avant d'accéder au reste */
  mustChangePassword: boolean
  hasSignature: boolean
  /** Notifications : délai avant l'anniversaire des baux (jours) et canaux */
  notifyDaysBefore: number
  notifyEmail: boolean
  ntfyTopic: string | null
  freeMobileUser: string | null
  hasFreeMobileKey: boolean
}

/** Annuaire : tous les comptes (avec le rôle) pour l'administrateur, soi et ses copropriétaires sinon. */
export interface DirectoryUser {
  id: string
  firstName: string
  lastName: string
  email: string
  role?: 'ADMIN' | 'USER'
}
/** Libellés des rôles : USER = propriétaire (ne voit que ses biens et ses copropriétaires). */
export const ROLE_LABELS = { ADMIN: 'Administrateur', USER: 'Propriétaire' } as const

export interface CreateUserInput {
  email: string
  firstName: string
  lastName: string
  password: string
  role?: 'ADMIN' | 'USER'
}

export type UpdateProfileInput = Partial<Pick<Profile, 'email' | 'firstName' | 'lastName' | 'address' | 'zipCode' | 'city' | 'notifyDaysBefore' | 'notifyEmail' | 'ntfyTopic' | 'freeMobileUser'>> & {
  /** Clé SMS Free Mobile : chaîne vide pour l'effacer, absente pour la garder */
  freeMobileKey?: string | null
}

export interface AppNotification {
  id: string
  kind: string
  leaseId: string | null
  dueDate: string | null
  title: string
  body: string
  /** Chemin dans l'application (/leases/…) ou adresse complète si APP_URL est configurée */
  link: string | null
  readAt: string | null
  createdAt: string
}
export type ChannelResult = 'sent' | 'disabled' | 'not_configured' | { error: string }
export interface NotificationTestResult { email: ChannelResult; ntfy: ChannelResult; sms: ChannelResult }
export interface OwnerInput { userId: string; share: number; startDate?: string | null; endDate?: string | null }

// ── Phase 4 : IRL, révisions, charges, régularisations ──
export interface IrlIndex {
  id: string; quarter: number; year: number; value: number
  /** INSEE : importé automatiquement ; MANUAL : saisi à la main */
  source: 'INSEE' | 'MANUAL'
  /** Date de publication au Journal officiel (import INSEE) */
  publishedAt: string | null
}
/** Dernière vérification des indices auprès de l'INSEE (null : pas encore faite depuis le démarrage de l'API) */
export interface IrlSyncResult { checkedAt: string; added: number; corrected: number; latest: { year: number; quarter: number } | null; error?: string }
export interface IrlRef { value: number; quarter: number; year: number }
export interface RevisionPreview {
  leaseId: string
  currentRent: number
  nextRevisionDate: string
  effectiveDate: string
  lastRevisionDate: string | null
  /** Ce qui manque pour réviser : l'IRL de référence du bail, ou l'indice publié */
  missing: 'REFERENCE' | 'INDEX' | null
  reference: IrlRef | null
  newIndex: IrlRef | null
  expectedIndex: { quarter: number; year: number } | null
  computedRent: number | null
}
export interface RentRevision {
  id: string
  leaseId: string
  effectiveDate: string
  previousRent: number
  newRent: number
  previousIrlValue: number
  previousIrlQuarter: number
  previousIrlYear: number
  newIrlValue: number
  newIrlYear: number
  createdAt: string
}
/** quarter : trimestre (1 à 4), ou null pour l'année entière */
export interface Charge { id: string; propertyId: string; year: number; quarter: number | null; label: string; amount: number }
export interface CreateChargeInput { propertyId: string; year: number; quarter?: number | null; label: string; amount: number }
/** Prochain rappel de révision d'un bail pour l'utilisateur connecté. */
export interface UpcomingReminder {
  leaseId: string
  tenantName: string
  propertyName: string
  anniversary: string
  /** Date à partir de laquelle le rappel part (anniversaire − délai réglé dans Paramètres) */
  remindOn: string
  daysLeft: number
  /** planned : à venir ; sent : envoyé ; past : anniversaire passé (révision à faire) ; not_owner : plus propriétaire à cette date */
  status: 'planned' | 'sent' | 'past' | 'not_owner'
  sentAt: string | null
}
export interface ChargeAllocation {
  propertyId: string
  propertyName: string
  total: number
  tenants: {
    leaseId: string; tenantName: string; startDate: string; endDate: string | null; occupiedDays: number
    share: number; provisions: number; balance: number; missingMonths: number[]
    /** outdated : les charges ou les provisions ont changé depuis l'enregistrement ; currentBalance : solde recalculé */
    regularization: { id: string; balance: number; outdated: boolean; currentBalance: number | null } | null
  }[]
  /** Part des charges tombant pendant la vacance (non refacturable) */
  vacancy: number
  owners: { userId: string; name: string; share: number; startDate: string | null; endDate: string | null; amount: number }[]
}
export interface ChargeRegularization {
  id: string
  leaseId: string
  year: number
  occupiedDays: number
  daysInYear: number
  totalCharged: number
  totalReal: number
  balance: number
  sentAt: string | null
  createdAt: string
}
export interface RegularizationPreview {
  year: number
  occupiedDays: number
  daysInYear: number
  charges: { id: string; label: string; quarter: number | null; amount: number; occupiedDays: number; periodDays: number; share: number }[]
  totalCharges: number
  totalReal: number
  totalCharged: number
  balance: number
  missingMonths: number[]
  suggestedMonthlyCharges: number
  existing: ChargeRegularization | null
  /** La régularisation enregistrée ne correspond plus au calcul ci-dessus */
  outdated: boolean
}
/** Régularisation enregistrée qui ne correspond plus aux charges ou aux provisions (alerte) */
export interface OutdatedRegularization {
  id: string; leaseId: string; year: number; createdAt: string; tenantName: string; propertyName: string
  balance: number; currentBalance: number | null
}

export type DocumentCategory =
  | 'LEASE_CONTRACT' | 'INVENTORY_ENTRY' | 'INVENTORY_EXIT' | 'INSURANCE' | 'PHOTO'
  | 'DIAGNOSTIC' | 'TITLE_DEED' | 'PROPERTY_TAX' | 'INVOICE' | 'OTHER'

/** Document envoyé, rattaché à un bail (leaseId) ou à un bien (propertyId) */
export interface DocumentItem {
  id: string
  label: string
  fileName: string
  mimeType: string
  size: number
  category: DocumentCategory
  leaseId: string | null
  propertyId: string | null
  createdAt: string
  property: { id: string; name: string } | null
  lease: {
    id: string; startDate: string; endDate: string | null; active: boolean
    property: { id: string; name: string }
    tenant: { id: string; firstName: string; lastName: string }
  } | null
}

export interface DocumentFilter { leaseId?: string; propertyId?: string; category?: DocumentCategory }
export type DocumentTarget = { leaseId: string } | { propertyId: string }

// ── Rapprochement bancaire ──

export interface BankAccount {
  id: string
  name: string
  createdAt: string
  transactionCount: number
  /** Encaissements pas encore rapprochés */
  toMatchCount: number
  lastTransactionDate: string | null
  // Connexion automatique (Enable Banking)
  connected: boolean
  /** Accord demandé à la banque, en attente de l'adresse de retour */
  connectionPending: boolean
  /** Comptes proposés par la banque, à choisir */
  accountChoices: { uid: string; label: string }[] | null
  bankName: string | null
  remoteLabel: string | null
  consentExpiresAt: string | null
  lastSyncAt: string | null
  lastSyncError: string | null
}

export interface BankConnectionBanks {
  configured: boolean
  banks: { name: string; beta: boolean }[]
}

export interface BankSyncResult {
  imported: number
  duplicates: number
  from: string | null
  to: string | null
  since: string
}

export type BankTransactionStatus = 'UNMATCHED' | 'MATCHED' | 'IGNORED'

/** Échéance résumée, telle que la renvoient les opérations et leurs suggestions */
export interface BankPaymentSummary {
  id: string
  periodYear: number
  periodMonth: number
  expectedAmount: number
  receivedAmount: number | null
  status: PaymentStatus
  dueDate?: string
  lease: {
    id: string
    property: { id: string; name: string }
    tenant: { id: string; firstName: string; lastName: string }
  }
}

export interface BankAllocation { rentPaymentId: string; amount: number }

export interface BankSuggestion {
  allocations: (BankAllocation & { payment: BankPaymentSummary })[]
  score: number
  confidence: 'high' | 'medium'
  reasons: string[]
}

export interface BankTransaction {
  id: string
  accountId: string
  account: { id: string; name: string }
  amount: number
  label: string
  date: string
  status: BankTransactionStatus
  rentPayments: BankPaymentSummary[]
  suggestions?: BankSuggestion[]
}

export interface BankTransactionFilter {
  accountId?: string
  status?: BankTransactionStatus
  direction?: 'credit' | 'debit'
  year?: number
}

export interface BankImportResult {
  imported: number
  duplicates: number
  skipped: { line: number; reason: string }[]
  from: string | null
  to: string | null
}
