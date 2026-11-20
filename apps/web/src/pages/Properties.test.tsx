import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { Properties } from './Properties'
import { mockApi, renderWithProviders, property } from '../test/utils'

describe('page Biens', () => {
  it('affiche un état vide sans bien', async () => {
    mockApi({ '/api/properties': [] })
    renderWithProviders(<Properties />)
    expect(await screen.findByText('Aucun bien')).toBeInTheDocument()
  })

  it('liste les biens avec leur statut d’occupation', async () => {
    mockApi({
      '/api/properties': [
        property(),
        property({ id: 'p2', name: 'Parking Part-Dieu', type: 'PARKING', surface: 12, leases: [{ id: 'l1', active: true }] }),
      ],
    })
    renderWithProviders(<Properties />)
    expect(await screen.findByText('T3 Lyon 3e')).toBeInTheDocument()
    expect(screen.getByText('Parking Part-Dieu')).toBeInTheDocument()
    expect(screen.getByText('Vacant')).toBeInTheDocument()
    expect(screen.getByText('Occupé')).toBeInTheDocument()
  })
})
