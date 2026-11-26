import { Prisma, TransactionStatus } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { ownedLease } from './tenants'

const paymentSelect = {
  id: true,
  periodYear: true,
  periodMonth: true,
  expectedAmount: true,
  receivedAmount: true,
  status: true,
  lease: {
    select: {
      id: true,
      property: { select: { id: true, name: true } },
      tenant: { select: { id: true, firstName: true, lastName: true } },
    },
  },
} satisfies Prisma.RentPaymentSelect

const transactionInclude = {
  account: { select: { id: true, name: true } },
  rentPayments: { select: paymentSelect, orderBy: [{ periodYear: 'asc' }, { periodMonth: 'asc' }] },
} satisfies Prisma.BankTransactionInclude

export type TransactionWithPayments = Prisma.BankTransactionGetPayload<{ include: typeof transactionInclude }>

export type TransactionFilter = {
  userId: string
  accountId?: string
  status?: TransactionStatus
  direction?: 'credit' | 'debit'
  year?: number
}

export const bankRepository = {
  findAccounts(userId: string) {
    return prisma.bankAccount.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } })
  },

  /** Nombre d'opérations par compte et par statut, et date de la dernière opération. */
  accountStats(accountIds: string[]) {
    return Promise.all([
      prisma.bankTransaction.groupBy({ by: ['accountId', 'status'], where: { accountId: { in: accountIds } }, _count: true }),
      prisma.bankTransaction.groupBy({ by: ['accountId'], where: { accountId: { in: accountIds } }, _max: { date: true } }),
      prisma.bankTransaction.groupBy({
        by: ['accountId'],
        where: { accountId: { in: accountIds }, status: 'UNMATCHED', amount: { gt: 0 } },
        _count: true,
      }),
    ])
  },

  findAccount(id: string, userId: string) {
    return prisma.bankAccount.findFirst({ where: { id, userId } })
  },

  createAccount(userId: string, name: string) {
    return prisma.bankAccount.create({ data: { userId, name } })
  },

  updateAccount(id: string, name: string) {
    return prisma.bankAccount.update({ where: { id }, data: { name } })
  },

  setConnection(id: string, data: Prisma.BankAccountUpdateInput) {
    return prisma.bankAccount.update({ where: { id }, data })
  },

  findAccountByState(state: string, userId: string) {
    return prisma.bankAccount.findFirst({ where: { pendingState: state, userId } })
  },

  /** Comptes reliés à la banque (synchronisation automatique). */
  findConnectedAccounts() {
    return prisma.bankAccount.findMany({ where: { ebSessionId: { not: null }, ebAccountUid: { not: null } } })
  },

  latestTransactionDate(accountId: string) {
    return prisma.bankTransaction.aggregate({ where: { accountId }, _max: { date: true } })
  },

  deleteAccount(id: string) {
    return prisma.bankAccount.delete({ where: { id } })
  },

  countMatched(accountId: string) {
    return prisma.bankTransaction.count({ where: { accountId, status: 'MATCHED' } })
  },

  createTransactions(data: Prisma.BankTransactionCreateManyInput[]) {
    return prisma.bankTransaction.createMany({ data, skipDuplicates: true })
  },

  findTransactions({ userId, accountId, status, direction, year }: TransactionFilter) {
    return prisma.bankTransaction.findMany({
      where: {
        account: { userId },
        accountId,
        status,
        amount: direction === 'credit' ? { gt: 0 } : direction === 'debit' ? { lt: 0 } : undefined,
        date: year ? { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } : undefined,
      },
      include: transactionInclude,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    })
  },

  findTransaction(id: string, userId: string) {
    return prisma.bankTransaction.findFirst({ where: { id, account: { userId } }, include: transactionInclude })
  },

  /** Échéances des baux de l'utilisateur pas encore rapprochées, dont la période touche l'intervalle. */
  findCandidatePayments(userId: string, from: Date, to: Date) {
    return prisma.rentPayment.findMany({
      where: { lease: ownedLease(userId), bankTransactionId: null, periodEnd: { gte: from }, periodStart: { lte: to } },
      include: {
        lease: {
          select: {
            id: true,
            rentDayOfMonth: true,
            bankLabel: true,
            property: { select: { id: true, name: true } },
            tenant: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    })
  },

  findPaymentsForMatch(ids: string[], userId: string) {
    return prisma.rentPayment.findMany({
      where: { id: { in: ids }, lease: ownedLease(userId) },
      include: { receipt: true },
    })
  },

  /** Rapproche : met à jour les échéances et le statut de l'opération en une transaction. */
  applyMatch(
    transactionId: string,
    updates: { id: string; data: Prisma.RentPaymentUncheckedUpdateInput }[],
    receiptIds: string[]
  ) {
    return prisma.$transaction([
      prisma.receipt.deleteMany({ where: { rentPaymentId: { in: receiptIds } } }),
      ...updates.map((u) => prisma.rentPayment.update({ where: { id: u.id }, data: u.data })),
      prisma.bankTransaction.update({ where: { id: transactionId }, data: { status: 'MATCHED' } }),
    ])
  },

  /** Défait le rapprochement : les échéances repassent en attente. */
  undoMatch(transactionId: string, paymentIds: string[]) {
    return prisma.$transaction([
      prisma.receipt.deleteMany({ where: { rentPaymentId: { in: paymentIds } } }),
      prisma.rentPayment.updateMany({
        where: { id: { in: paymentIds } },
        data: { bankTransactionId: null, receivedAmount: null, paymentDate: null, status: 'PENDING', source: 'MANUAL' },
      }),
      prisma.bankTransaction.update({ where: { id: transactionId }, data: { status: 'UNMATCHED' } }),
    ])
  },

  findReceipts(paymentIds: string[]) {
    return prisma.receipt.findMany({ where: { rentPaymentId: { in: paymentIds } } })
  },

  setStatus(id: string, status: TransactionStatus) {
    return prisma.bankTransaction.update({ where: { id }, data: { status } })
  },
}
