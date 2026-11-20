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
  phone?: string
  iban?: string
  createdAt: string
  leases: Lease[]
}

export interface Lease {
  id: string
  propertyId: string
  tenantId: string
  type: LeaseType
  startDate: string
  endDate?: string
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
  phone?: string
  iban?: string
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
}

export type UpdateProfileInput = Partial<Pick<Profile, 'firstName' | 'lastName' | 'address' | 'zipCode' | 'city'>>
