import { describe, it, expect, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Rents } from './Rents'
import { mockApi, renderWithProviders } from '../test/utils'

const now = new Date()
const year = now.getFullYear()
const month = now.getMonth() + 1
const listPath = `/api/rent-payments?year=${year}&month=${month}`
const mm = String(month).padStart(2, '0')

const payment = (over: Record<string, unknown> = {}) => ({
  id: 'rp1',
  leaseId: 'l1',
  periodYear: year,
  periodMonth: month,
  periodStart: `${year}-${mm}-01T00:00:00.000Z`,
  periodEnd: `${year}-${mm}-28T00:00:00.000Z`,
  rentAmount: 800,
  chargesAmount: 50,
  expectedAmount: 850,
  receivedAmount: null,
  paymentDate: null,
  status: 'LATE',
  dueDate: `${year}-${mm}-01T00:00:00.000Z`,
  receipt: null,
  lease: {
    id: 'l1',
    rentDayOfMonth: 1,
    property: { id: 'p1', name: 'T3 Lyon 3e', address: '12 rue de la République', city: 'Lyon' },
    tenant: { id: 't1', firstName: 'Jean', lastName: 'Dupont', email: 'jean@example.com' },
  },
  ...over,
})

describe('page Loyers', () => {
  it('liste les échéances du mois avec leur statut et le total', async () => {
    mockApi({
      [listPath]: [
        payment(),
        payment({
          id: 'rp2', status: 'RECEIVED', receivedAmount: 600, expectedAmount: 600, paymentDate: `${year}-${mm}-03T00:00:00.000Z`,
          receipt: { id: 'r1', rentPaymentId: 'rp2', filePath: 'x.pdf', sentAt: null, createdAt: '' },
          lease: { id: 'l2', rentDayOfMonth: 5, property: { id: 'p2', name: 'Studio Paris', address: '', city: 'Paris' }, tenant: { id: 't2', firstName: 'Anne', lastName: 'Martin', email: '' } },
        }),
      ],
    })
    renderWithProviders(<Rents />)

    const late = (await screen.findByText('T3 Lyon 3e')).closest('div.p-4') as HTMLElement
    expect(within(late).getByText('En retard')).toBeInTheDocument()
    expect(within(late).getByRole('button', { name: /Encaisser/ })).toBeInTheDocument()

    const paid = screen.getByText('Studio Paris').closest('div.p-4') as HTMLElement
    expect(within(paid).getByText('Payé')).toBeInTheDocument()
    expect(within(paid).getByRole('link', { name: /Voir la quittance/ })).toHaveAttribute('href', '/api/rent-payments/rp2/receipt')
    expect(within(paid).getByRole('link', { name: /Télécharger/ })).toHaveAttribute('href', '/api/rent-payments/rp2/receipt?download')

    // Attendu 850 + 600, encaissé 600
    expect(screen.getByText(/1\s450,00\s€/)).toBeInTheDocument()
  })

  it('génère les échéances du mois affiché', async () => {
    const fetchMock = mockApi({ [listPath]: [], '/api/rent-payments/generate': { created: 0, payments: [] } })
    renderWithProviders(<Rents />)
    expect(await screen.findByText('Aucune échéance ce mois-ci')).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: /Générer le mois/ })[0])
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/rent-payments/generate', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ year, month }),
      }))
    )
  })

  it('affiche l’erreur de l’API avec un lien vers les Paramètres', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return new Response(JSON.stringify({ error: 'Adresse du bailleur manquante (Thomas Admin) : complétez-la dans Paramètres' }), { status: 409 })
      }
      const body = String(input) === listPath ? [payment({ status: 'RECEIVED', receivedAmount: 850, paymentDate: `${year}-${mm}-02T00:00:00.000Z` })] : []
      return new Response(JSON.stringify(body), { status: 200 })
    }))
    renderWithProviders(<Rents />)
    fireEvent.click(await screen.findByRole('button', { name: /Établir la quittance/ }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Adresse du bailleur manquante')
    expect(within(alert).getByRole('link', { name: /Paramètres/ })).toHaveAttribute('href', '/settings')
  })
})
