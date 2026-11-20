import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { Dashboard } from './Dashboard'
import { mockApi, renderWithProviders, property, lease } from '../test/utils'

const now = new Date()
const year = now.getFullYear()
const month = now.getMonth() + 1
const mm = String(month).padStart(2, '0')
const currentPath = `/api/rent-payments?year=${year}&month=${month}`

const payment = (over: Record<string, unknown> = {}) => ({
  id: 'rp1', leaseId: 'l1', periodYear: year, periodMonth: month,
  periodStart: `${year}-${mm}-01T00:00:00.000Z`, periodEnd: `${year}-${mm}-28T00:00:00.000Z`,
  rentAmount: 800, chargesAmount: 50, expectedAmount: 850, receivedAmount: null, paymentDate: null,
  status: 'LATE', dueDate: `${year}-${mm}-01T00:00:00.000Z`, receipt: null,
  lease: { id: 'l1', rentDayOfMonth: 1, property: { id: 'p1', name: 'T3 Lyon 3e', address: '', city: 'Lyon' }, tenant: { id: 't1', firstName: 'Jean', lastName: 'Dupont', email: '' } },
  ...over,
})

// Bail commencé il y a 6 mois : pas de révision ni de fin dans les 90 jours
const sixMonthsAgo = new Date(year, now.getMonth() - 6, 1).toISOString()

describe('Tableau de bord', () => {
  it('calcule les indicateurs (revenus des baux actifs, loyers reçus du mois)', async () => {
    mockApi({
      '/api/properties': [property(), property({ id: 'p2', name: 'Studio' })],
      '/api/leases': [lease({ startDate: sixMonthsAgo }), lease({ id: 'l2', propertyId: 'p2', active: false, rentAmount: 500 })],
      [currentPath]: [payment({ status: 'RECEIVED', receivedAmount: 850, paymentDate: `${year}-${mm}-02T00:00:00.000Z` })],
    })
    renderWithProviders(<Dashboard />)
    const card = (await screen.findByText('Revenus mensuels')).parentElement!
    await waitFor(() => expect(card).toHaveTextContent(/850,00/))
    expect(screen.getByText('Bien(s) vacant(s)').parentElement).toHaveTextContent('1')
    await waitFor(() => expect(screen.getByText('Loyers reçus ce mois').parentElement).toHaveTextContent('1/1'))
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })

  it('affiche le suivi mensuel et alerte sur les loyers en retard et les échéances à générer', async () => {
    mockApi({
      '/api/properties': [property(), property({ id: 'p2', name: 'Studio' })],
      '/api/leases': [
        lease({ startDate: sixMonthsAgo }),
        lease({ id: 'l2', propertyId: 'p2', startDate: sixMonthsAgo, property: { id: 'p2', name: 'Studio', address: '', city: 'Lyon' } }),
      ],
      [currentPath]: [payment()],
    })
    renderWithProviders(<Dashboard />)
    expect(await screen.findByText('1 loyer en retard ce mois-ci')).toBeInTheDocument()
    expect(screen.getByText(/1 bail sans échéance/)).toBeInTheDocument()
    const row = (await screen.findByText('Jean Dupont')).closest('tr')!
    expect(row).toHaveTextContent('En retard')
    expect(row).toHaveTextContent('À établir')
  })
})
