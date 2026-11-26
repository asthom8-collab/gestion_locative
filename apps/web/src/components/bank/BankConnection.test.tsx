import { describe, it, expect, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { BankConnection } from './BankConnection'
import { mockApi, renderWithProviders } from '../../test/utils'
import type { BankAccount } from '../../types'

const account = (over: Partial<BankAccount> = {}): BankAccount => ({
  id: 'a1', name: 'Compte commun', createdAt: '', transactionCount: 0, toMatchCount: 0, lastTransactionDate: null,
  connected: false, connectionPending: false, accountChoices: null, bankName: null, remoteLabel: null,
  consentExpiresAt: null, lastSyncAt: null, lastSyncError: null,
  ...over,
})
const banks = { configured: true, banks: [{ name: "Banque Exemple Mutualiste", beta: true }, { name: 'Autre Banque', beta: false }] }

describe('connexion du compte à la banque', () => {
  it('ne s’affiche pas si la connexion bancaire n’est pas configurée', async () => {
    const fetchMock = mockApi({ '/api/bank-connection/banks': { configured: false, banks: [] } })
    const { container } = renderWithProviders(<BankConnection account={account()} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('choisit la banque par recherche et ouvre son site', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const fetchMock = mockApi({ '/api/bank-connection/banks': banks, 'POST /api/bank-accounts/a1/connect': { url: 'https://banque.example/auth' } })
    renderWithProviders(<BankConnection account={account()} />)
    fireEvent.click(await screen.findByRole('button', { name: /Connecter la banque/ }))
    fireEvent.change(screen.getByLabelText('Rechercher une banque'), { target: { value: 'exemple' } })
    expect(screen.queryByText('Autre Banque')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Banque Exemple Mutualiste/ }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/bank-accounts/a1/connect', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ bankName: "Banque Exemple Mutualiste" }),
    })))
    await waitFor(() => expect(open).toHaveBeenCalledWith('https://banque.example/auth', '_blank', 'noopener'))
  })

  it('prévient, à la première connexion, que le compte contient déjà des opérations', async () => {
    mockApi({ '/api/bank-connection/banks': banks })
    renderWithProviders(<BankConnection account={account({ transactionCount: 853, lastTransactionDate: '2026-11-20T00:00:00.000Z' })} />)
    fireEvent.click(await screen.findByRole('button', { name: /Connecter la banque/ }))
    expect(screen.getByRole('note')).toHaveTextContent(/déjà 853 opérations \(la dernière le 20\/11\/2026\)/)
    expect(screen.getByRole('note')).toHaveTextContent(/compte à part/)
  })

  it('ne prévient pas pour un compte vide', async () => {
    mockApi({ '/api/bank-connection/banks': banks })
    renderWithProviders(<BankConnection account={account()} />)
    fireEvent.click(await screen.findByRole('button', { name: /Connecter la banque/ }))
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('termine la connexion avec l’adresse de retour recopiée, puis propose les comptes', async () => {
    const fetchMock = mockApi({
      '/api/bank-connection/banks': banks,
      'POST /api/bank-accounts/a1/connect/complete': account({ accountChoices: [{ uid: 'u1', label: 'Compte de dépôt · FR76 …0123' }] }),
    })
    renderWithProviders(<BankConnection account={account({ connectionPending: true, bankName: "Banque Exemple Mutualiste" })} />)
    fireEvent.change(await screen.findByLabelText('Adresse de retour de la banque'), { target: { value: 'https://localhost:5176/bank?state=s&code=c' } })
    fireEvent.click(screen.getByRole('button', { name: /Terminer la connexion/ }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/bank-accounts/a1/connect/complete', expect.objectContaining({
      body: JSON.stringify({ returnUrl: 'https://localhost:5176/bank?state=s&code=c' }),
    })))
  })

  it('relie le compte choisi parmi ceux que propose la banque', async () => {
    const fetchMock = mockApi({ '/api/bank-connection/banks': banks, 'PUT /api/bank-accounts/a1/connect/account': account({ connected: true }) })
    renderWithProviders(<BankConnection account={account({ accountChoices: [{ uid: 'u1', label: 'Compte de dépôt · FR76 …0123' }, { uid: 'u2', label: 'Livret A' }] })} />)
    fireEvent.click(await screen.findByRole('button', { name: /Compte de dépôt · FR76 …0123/ }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/bank-accounts/a1/connect/account', expect.objectContaining({
      method: 'PUT', body: JSON.stringify({ uid: 'u1' }),
    })))
  })

  it('affiche l’état d’un compte relié, synchronise et prévient de l’expiration de l’accord', async () => {
    const soon = new Date(Date.now() + 5 * 86_400_000).toISOString()
    const fetchMock = mockApi({
      '/api/bank-connection/banks': banks,
      'POST /api/bank-accounts/a1/sync': { imported: 3, duplicates: 1, from: null, to: null, since: '' },
    })
    renderWithProviders(<BankConnection account={account({
      connected: true, bankName: "Banque Exemple Mutualiste", remoteLabel: 'Compte de dépôt · FR76 …0123',
      consentExpiresAt: soon, lastSyncAt: '2026-11-25T08:00:00.000Z', lastSyncError: 'Enable Banking (401) : session expirée',
    })} />)
    expect(await screen.findByText(/Relié à Banque Exemple Mutualiste · Compte de dépôt/)).toBeInTheDocument()
    expect(screen.getByText(/dans 5 jours/)).toBeInTheDocument()
    expect(screen.getByText(/session expirée/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Renouveler l’accord/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Synchroniser$/ }))
    expect(await screen.findByText('3 nouvelles opérations reçues')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/bank-accounts/a1/sync', expect.objectContaining({ method: 'POST' }))
  })
})
