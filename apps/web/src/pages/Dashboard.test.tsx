import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { Dashboard } from './Dashboard'
import { mockApi, renderWithProviders, property, lease } from '../test/utils'

describe('Tableau de bord', () => {
  it('calcule les revenus mensuels (loyer + charges des baux actifs)', async () => {
    mockApi({
      '/api/properties': [property(), property({ id: 'p2', name: 'Studio' })],
      '/api/leases': [lease(), lease({ id: 'l2', propertyId: 'p2', active: false, rentAmount: 500 })],
    })
    renderWithProviders(<Dashboard />)
    const card = (await screen.findByText('Revenus mensuels')).parentElement!
    await waitFor(() => expect(card).toHaveTextContent(/850,00/))
    expect(screen.getByText('Bail(s) actif(s)').parentElement).toHaveTextContent('1')
    expect(screen.getByText('Bien(s) vacant(s)').parentElement).toHaveTextContent('1')
  })
})
