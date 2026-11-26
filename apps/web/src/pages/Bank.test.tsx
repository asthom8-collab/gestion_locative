import { describe, it, expect, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Bank } from './Bank'
import { mockApi, renderWithProviders } from '../test/utils'

const account = { id: 'a1', name: 'Compte commun', createdAt: '', transactionCount: 3, toMatchCount: 2, lastTransactionDate: '2026-03-06T00:00:00.000Z' }
const summary = (over: Record<string, unknown> = {}) => ({
  id: 'rp3', periodYear: 2026, periodMonth: 3, expectedAmount: 850, receivedAmount: null, status: 'PENDING',
  lease: { id: 'l1', property: { id: 'p1', name: 'T3 Lyon 3e' }, tenant: { id: 't1', firstName: 'Jean', lastName: 'Dupont' } },
  ...over,
})
const tx = (over: Record<string, unknown> = {}) => ({
  id: 'tx1', accountId: 'a1', account: { id: 'a1', name: 'Compte commun' }, amount: 850, label: 'VIR SEPA DUPONT JEAN',
  date: '2026-03-04T00:00:00.000Z', status: 'UNMATCHED', rentPayments: [], suggestions: [],
  ...over,
})
const todoPath = '/api/bank-transactions?status=UNMATCHED&direction=credit'

describe('page Synchro bancaire', () => {
  it('propose de créer le compte quand il n’y en a pas', async () => {
    const fetchMock = mockApi({ '/api/bank-accounts': [], 'POST /api/bank-accounts': account })
    renderWithProviders(<Bank />)
    fireEvent.click(await screen.findByRole('button', { name: /Créer le compte/ }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/bank-accounts', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ name: 'Compte commun' }),
    })))
  })

  it('affiche les suggestions, valide en un clic et valide en bloc les correspondances sûres', async () => {
    const sure = { score: 110, confidence: 'high', reasons: ['Montant exact', 'Nom « Dupont » dans le libellé'],
      allocations: [{ rentPaymentId: 'rp3', amount: 850, payment: summary() }] }
    const maybe = { score: 65, confidence: 'medium', reasons: ['Montant exact'],
      allocations: [{ rentPaymentId: 'rp9', amount: 600, payment: summary({ id: 'rp9', expectedAmount: 600 }) }] }
    const fetchMock = mockApi({
      '/api/bank-accounts': [account],
      [todoPath]: [tx({ suggestions: [sure] }), tx({ id: 'tx2', amount: 600, label: 'VIR INCONNU', suggestions: [maybe] })],
      'POST /api/bank-transactions/tx1/match': tx({ status: 'MATCHED' }),
      'POST /api/bank-transactions/tx2/match': tx({ id: 'tx2', status: 'MATCHED' }),
    })
    renderWithProviders(<Bank />)

    expect(await screen.findByText('VIR SEPA DUPONT JEAN')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'À rapprocher (2)' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText(/Montant exact · Nom « Dupont » dans le libellé/)).toBeInTheDocument()
    expect(screen.getByText(/1 encaissement correspond sans ambiguïté/)).toBeInTheDocument()

    // La liste sous le bouton montre ce qui sera validé
    const bulk = screen.getByRole('region', { name: 'Validation en bloc' })
    expect(within(bulk).getByText(/04\/03\/2026 · VIR SEPA DUPONT JEAN/)).toBeInTheDocument()
    expect(within(bulk).getByText('→ Jean Dupont · T3 Lyon 3e · mars 2026')).toBeInTheDocument()
    expect(within(bulk).queryByText(/VIR INCONNU/)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Tout valider/ }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/bank-transactions/tx1/match', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ allocations: [{ rentPaymentId: 'rp3', amount: 850 }] }),
    })))
    // La suggestion incertaine n'est pas validée en bloc
    expect(fetchMock).not.toHaveBeenCalledWith('/api/bank-transactions/tx2/match', expect.anything())

    fireEvent.click(screen.getAllByRole('button', { name: /^Valider$/ })[1])
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/bank-transactions/tx2/match', expect.objectContaining({ method: 'POST' })))
  })

  it('ignore une opération et défait un rapprochement', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const year = new Date().getFullYear()
    const fetchMock = mockApi({
      '/api/bank-accounts': [account],
      [todoPath]: [tx()],
      [`/api/bank-transactions?status=MATCHED&year=${year}`]: [tx({ status: 'MATCHED', rentPayments: [summary({ receivedAmount: 850, status: 'RECEIVED' })] })],
      'PUT /api/bank-transactions/tx1/status': tx({ status: 'IGNORED' }),
      'DELETE /api/bank-transactions/tx1/match': tx(),
    })
    renderWithProviders(<Bank />)
    expect(await screen.findByText(/Aucun loyer ne correspond/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Ignorer/ }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/bank-transactions/tx1/status', expect.objectContaining({
      method: 'PUT', body: JSON.stringify({ status: 'IGNORED' }),
    })))

    fireEvent.click(screen.getByRole('tab', { name: 'Rapprochés' }))
    expect(await screen.findByText(/Jean Dupont · T3 Lyon 3e · mars 2026 · 850,00/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Défaire/ }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/bank-transactions/tx1/match', expect.objectContaining({ method: 'DELETE' })))
  })

  it('ne valide en bloc que les lignes cochées', async () => {
    const sureFor = (id: string, month: number) => ({ score: 110, confidence: 'high', reasons: ['Montant exact'],
      allocations: [{ rentPaymentId: id, amount: 850, payment: summary({ id, periodMonth: month }) }] })
    const fetchMock = mockApi({
      '/api/bank-accounts': [account],
      [todoPath]: [tx({ suggestions: [sureFor('rp3', 3)] }), tx({ id: 'tx2', date: '2026-04-03T00:00:00.000Z', suggestions: [sureFor('rp4', 4)] })],
      'POST /api/bank-transactions/tx2/match': tx({ id: 'tx2', status: 'MATCHED' }),
    })
    renderWithProviders(<Bank />)
    fireEvent.click(await screen.findByRole('checkbox', { name: /du 04\/03\/2026/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Valider la sélection (1)' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/bank-transactions/tx2/match', expect.objectContaining({ method: 'POST' })))
    expect(fetchMock).not.toHaveBeenCalledWith('/api/bank-transactions/tx1/match', expect.anything())
  })

  it('importe un relevé et affiche le résumé', async () => {
    const fetchMock = mockApi({
      '/api/bank-accounts': [account],
      [todoPath]: [],
      'POST /api/bank-accounts/a1/import': { imported: 12, duplicates: 3, skipped: [{ line: 9, reason: 'date illisible' }], from: '2026-03-01T00:00:00.000Z', to: '2026-03-31T00:00:00.000Z' },
    })
    renderWithProviders(<Bank />)
    const input = await screen.findByLabelText('Relevé CSV — Compte commun')
    const file = new File(['Date;Libellé;Montant'], 'releve.csv', { type: 'text/csv' })
    fireEvent.change(input, { target: { files: [file] } })
    expect(await screen.findByText('12 opérations importées, 3 déjà présentes')).toBeInTheDocument()
    expect(screen.getByText(/9 \(date illisible\)/)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/bank-accounts/a1/import', expect.objectContaining({ method: 'POST', body: file }))
  })
})
