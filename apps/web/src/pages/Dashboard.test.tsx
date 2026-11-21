import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { Dashboard, coversMonth, buildAlerts } from './Dashboard'
import type { Lease } from '../types'
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

describe('coversMonth (même règle que la génération des échéances côté API)', () => {
  const nov = { year: 2026, month: 11 }
  const l = (startDate: string, endDate: string | null, active = true) => ({ startDate, endDate, active })
  it('bail en cours sans date de fin', () => expect(coversMonth(l('2025-01-01T00:00:00.000Z', null), nov)).toBe(true))
  it('bail qui commence le dernier jour du mois', () => expect(coversMonth(l('2026-11-30T00:00:00.000Z', null), nov)).toBe(true))
  it('bail qui commence le mois suivant', () => expect(coversMonth(l('2026-12-01T00:00:00.000Z', null), nov)).toBe(false))
  it('bail résilié dans le mois : dernier mois proratisé', () => expect(coversMonth(l('2025-01-01T00:00:00.000Z', '2026-11-10T00:00:00.000Z', false), nov)).toBe(true))
  it('bail encore actif mais dont la fin est passée', () => expect(coversMonth(l('2025-01-01T00:00:00.000Z', '2026-10-31T00:00:00.000Z'), nov)).toBe(false))
  it('bail inactif sans date de fin', () => expect(coversMonth(l('2025-01-01T00:00:00.000Z', null, false), nov)).toBe(false))
})

describe('alerte de révision du loyer', () => {
  const now = new Date(2026, 10, 21) // 21 novembre 2026, anniversaire le 1er janvier
  const cur = { year: 2026, month: 11 }
  const revisionAlerts = (over: Record<string, unknown>) =>
    buildAlerts([lease(over) as unknown as Lease], [], now, cur).filter(a => a.title.startsWith('Révision du loyer'))

  it('rappelle la révision à moins de 90 jours de l’anniversaire', () => {
    const [a] = revisionAlerts({})
    expect(a.action).toEqual({ label: 'Réviser le loyer', to: '/leases/l1' })
  })
  it('ne rappelle plus une révision déjà appliquée pour cet anniversaire', () => {
    expect(revisionAlerts({ rentRevisions: [{ effectiveDate: '2027-01-01T00:00:00.000Z' }] })).toHaveLength(0)
  })
  it('rappelle encore si la dernière révision date de l’anniversaire précédent', () => {
    expect(revisionAlerts({ rentRevisions: [{ effectiveDate: '2026-01-01T00:00:00.000Z' }] })).toHaveLength(1)
  })
})
