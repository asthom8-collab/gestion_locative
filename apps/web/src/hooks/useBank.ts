import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { BankAllocation, BankTransactionFilter } from '../types'

export const useBankAccounts = () => useQuery({ queryKey: ['bank-accounts'], queryFn: api.bank.accounts })

export const useBankTransactions = (filter: BankTransactionFilter) =>
  useQuery({ queryKey: ['bank-transactions', filter], queryFn: () => api.bank.transactions(filter) })

/** Un rapprochement change les opérations, les comptes et les échéances (pages Loyers, Paiements, bail). */
function useBankMutation<V, R>(fn: (vars: V) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-accounts'] })
      qc.invalidateQueries({ queryKey: ['bank-transactions'] })
      qc.invalidateQueries({ queryKey: ['rent-payments'] })
    },
  })
}

export const useCreateBankAccount = () => useBankMutation((name: string) => api.bank.createAccount(name))
export const useRenameBankAccount = () => useBankMutation(({ id, name }: { id: string; name: string }) => api.bank.renameAccount(id, name))
export const useDeleteBankAccount = () => useBankMutation((id: string) => api.bank.deleteAccount(id))
export const useImportStatement = () =>
  useBankMutation(({ accountId, file }: { accountId: string; file: File }) => api.bank.importCsv(accountId, file))
export const useMatchTransaction = () =>
  useBankMutation(({ id, allocations }: { id: string; allocations: BankAllocation[] }) => api.bank.match(id, allocations))
export const useUnmatchTransaction = () => useBankMutation((id: string) => api.bank.unmatch(id))
export const useSetTransactionStatus = () =>
  useBankMutation(({ id, status }: { id: string; status: 'IGNORED' | 'UNMATCHED' }) => api.bank.setStatus(id, status))

export const useBankBanks = (enabled = true) =>
  useQuery({ queryKey: ['bank-connection', 'banks'], queryFn: api.bank.banks, enabled, staleTime: 3600_000 })
export const useConnectBank = () => useBankMutation(({ accountId, bankName }: { accountId: string; bankName: string }) => api.bank.connect(accountId, bankName))
export const useCompleteConnection = () =>
  useBankMutation(({ accountId, returnUrl }: { accountId: string; returnUrl: string }) => api.bank.completeConnection(accountId, returnUrl))
export const useChooseRemoteAccount = () =>
  useBankMutation(({ accountId, uid }: { accountId: string; uid: string }) => api.bank.chooseRemoteAccount(accountId, uid))
export const useDisconnectBank = () => useBankMutation((accountId: string) => api.bank.disconnect(accountId))
export const useSyncBank = () => useBankMutation((accountId: string) => api.bank.sync(accountId))
