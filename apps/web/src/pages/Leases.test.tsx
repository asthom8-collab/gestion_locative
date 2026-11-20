import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { Leases } from './Leases'
import { mockApi, renderWithProviders, property, lease } from '../test/utils'

describe('page Baux', () => {
  it('liste les baux avec bien et locataire', async () => {
    mockApi({
      '/api/properties': [property()],
      '/api/tenants': [{ id: 't1', firstName: 'Jean', lastName: 'Dupont', email: 'jean@example.com', leases: [] }],
      '/api/leases': [lease()],
    })
    renderWithProviders(<Leases />)
    expect(await screen.findByRole('heading', { name: 'Mes baux' })).toBeInTheDocument()
    expect(screen.getAllByText(/Dupont/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/T3 Lyon 3e/).length).toBeGreaterThan(0)
  })
})
