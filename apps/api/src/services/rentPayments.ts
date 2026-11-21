import { PaymentStatus } from '@prisma/client'
import { AppError } from '../middlewares/errorHandler'
import { computeMonthlyDue, dueDate, monthBounds, round2, toUtcDay } from '../lib/period'
import { renderReceiptPdf } from '../lib/receiptPdf'
import { landlordsFor } from './landlords'
import { removeFile, saveFile, storagePath } from '../lib/storage'
import { ListFilter, RentPaymentWithLease, rentPaymentsRepository } from '../repositories/rentPayments'

/** Ajoute la date d'exigibilité et le statut effectif (LATE si l'échéance est passée sans paiement). */
function present(p: RentPaymentWithLease, today = toUtcDay(new Date())) {
  const due = dueDate(p.periodStart, p.periodYear, p.periodMonth, p.lease.rentDayOfMonth)
  const status: PaymentStatus = p.status === 'PENDING' && due < today ? 'LATE' : p.status
  return { ...p, dueDate: due, status }
}

async function getOrThrow(id: string, userId: string) {
  const payment = await rentPaymentsRepository.findById(id, userId)
  if (!payment) throw new AppError(404, 'Échéance introuvable')
  return payment
}

async function dropReceipt(payment: { id: string; receipt: { filePath: string } | null }) {
  if (!payment.receipt) return
  await rentPaymentsRepository.deleteReceipt(payment.id)
  await removeFile(payment.receipt.filePath)
}

export const rentPaymentsService = {
  async list(filter: ListFilter) {
    const payments = await rentPaymentsRepository.findMany(filter)
    return payments.map((p) => present(p))
  },

  /** Crée les échéances manquantes du mois pour les baux de l'utilisateur qui le couvrent (idempotent). */
  async generate(userId: string, year: number, month: number) {
    const { start, end } = monthBounds(year, month)
    const leases = await rentPaymentsRepository.findLeasesCovering(start, end, userId)
    const rows = leases.flatMap((lease) => {
      const due = computeMonthlyDue(lease, year, month)
      return due ? [{ leaseId: lease.id, periodYear: year, periodMonth: month, ...due }] : []
    })
    const { count } = await rentPaymentsRepository.createMany(rows)
    return { created: count, payments: await rentPaymentsService.list({ userId, year, month }) }
  },

  /** Enregistre le montant total reçu pour l'échéance (remplace la saisie précédente). */
  async recordPayment(id: string, userId: string, receivedAmount: number, paymentDate: Date) {
    const payment = await getOrThrow(id, userId)
    const amount = round2(receivedAmount)
    const status: PaymentStatus = amount >= payment.expectedAmount ? 'RECEIVED' : 'PARTIAL'
    // Une quittance existante ne correspond plus au paiement saisi
    await dropReceipt(payment)
    const updated = await rentPaymentsRepository.update(id, {
      receivedAmount: amount,
      paymentDate,
      status,
      source: 'MANUAL',
    })
    return present(updated)
  },

  async cancelPayment(id: string, userId: string) {
    const payment = await getOrThrow(id, userId)
    if (payment.bankTransactionId) {
      throw new AppError(409, 'Ce paiement vient du rapprochement bancaire')
    }
    await dropReceipt(payment)
    const updated = await rentPaymentsRepository.update(id, {
      receivedAmount: null,
      paymentDate: null,
      status: 'PENDING',
    })
    return present(updated)
  },

  async remove(id: string, userId: string) {
    const payment = await getOrThrow(id, userId)
    if (payment.receivedAmount !== null) {
      throw new AppError(409, 'Un paiement est enregistré : annulez-le avant de supprimer l’échéance')
    }
    await rentPaymentsRepository.delete(id)
  },

  /** Génère (ou régénère) la quittance PDF d'une échéance payée en totalité. */
  async generateReceipt(id: string, userId: string) {
    const payment = await rentPaymentsRepository.findForReceipt(id, userId)
    if (!payment) throw new AppError(404, 'Échéance introuvable')
    if (payment.status !== 'RECEIVED' || !payment.paymentDate || payment.receivedAmount === null) {
      throw new AppError(409, 'Une quittance ne peut être établie que pour un loyer payé en totalité')
    }
    const { lease } = payment
    const pdf = await renderReceiptPdf({
      landlords: await landlordsFor(lease.property.ownerships),
      tenantName: `${lease.tenant.firstName} ${lease.tenant.lastName}`,
      propertyAddress: lease.property.address,
      propertyZipCode: lease.property.zipCode,
      propertyCity: lease.property.city,
      periodStart: payment.periodStart,
      periodEnd: payment.periodEnd,
      rentAmount: payment.rentAmount,
      chargesAmount: payment.chargesAmount,
      totalAmount: payment.expectedAmount,
      paymentDate: payment.paymentDate,
      issuedAt: new Date(),
    })
    const filePath = `pdfs/quittances/${payment.periodYear}/${payment.id}.pdf`
    await saveFile(filePath, pdf)
    return rentPaymentsRepository.upsertReceipt(payment.id, filePath)
  },

  /** Chemin absolu et nom de téléchargement de la quittance. */
  async getReceiptFile(id: string, userId: string) {
    const payment = await rentPaymentsRepository.findForReceipt(id, userId)
    if (!payment) throw new AppError(404, 'Échéance introuvable')
    if (!payment.receipt) throw new AppError(404, 'Pas de quittance pour cette échéance')
    const month = String(payment.periodMonth).padStart(2, '0')
    const tenant = payment.lease.tenant.lastName.normalize('NFD').replace(/[^A-Za-z0-9-]/g, '')
    return {
      path: storagePath(payment.receipt.filePath),
      downloadName: `quittance-${payment.periodYear}-${month}-${tenant}.pdf`,
    }
  },
}
