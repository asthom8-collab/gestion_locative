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
export type UpdateLeaseInput = Partial<Pick<CreateLeaseInput, 'type' | 'rentAmount' | 'chargesAmount' | 'rentDayOfMonth' | 'irlReference' | 'irlQuarter' | 'irlYear'>>

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

/** Annuaire des utilisateurs (choix des copropriétaires). */
export interface DirectoryUser {
  id: string
  firstName: string
  lastName: string
  email: string
}

export interface CreateUserInput {
  email: string
  firstName: string
  lastName: string
  password: string
  role?: 'ADMIN' | 'USER'
}

export type UpdateProfileInput = Partial<Pick<Profile, 'firstName' | 'lastName' | 'address' | 'zipCode' | 'city' | 'notifyDaysBefore' | 'notifyEmail' | 'ntfyTopic' | 'freeMobileUser'>> & {
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
export interface IrlIndex { id: string; quarter: number; year: number; value: number }
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
export interface ChargeAllocation {
  propertyId: string
  propertyName: string
  total: number
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
}
