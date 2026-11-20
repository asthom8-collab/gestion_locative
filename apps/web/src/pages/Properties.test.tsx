import { describe, it, expect, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { Properties, historySegments } from './Properties'
import { mockApi, renderWithProviders, property, lease, reply } from '../test/utils'
import type { Lease } from '../types'

describe('page Biens', () => {
  it('affiche un état vide sans bien', async () => {
    mockApi({ '/api/properties': [] })
    renderWithProviders(<Properties />)
    expect(await screen.findByText('Aucun bien')).toBeInTheDocument()
  })

  it('liste les biens avec leur statut, le régime fiscal et les propriétaires', async () => {
    mockApi({
      '/api/properties': [
        property({ fiscalRegime: 'LMNP_REEL', ownerships: [{ id: 'o1', userId: 'u1', share: 1, user: { id: 'u1', firstName: 'Thomas', lastName: 'Bailleur' } }] }),
        property({ id: 'p2', name: 'Parking Part-Dieu', type: 'PARKING', surface: 12, leases: [lease({ propertyId: 'p2' })] }),
      ],
    })
    renderWithProviders(<Properties />)
    expect(await screen.findByText('T3 Lyon 3e')).toBeInTheDocument()
    expect(screen.getByText('Vacant')).toBeInTheDocument()
    expect(screen.getByText('Occupé')).toBeInTheDocument()
    expect(screen.getByText('LMNP réel')).toBeInTheDocument()
    expect(screen.getByText('Thomas Bailleur')).toBeInTheDocument()
  })

  it('déplie l’historique des locataires du bien', async () => {
    mockApi({ '/api/properties': [property({ leases: [lease()] })] })
    renderWithProviders(<Properties />)
    fireEvent.click(await screen.findByText(/Historique des locataires \(1\)/))
    expect(screen.getByText('Jean Dupont')).toBeInTheDocument()
    expect(screen.getByText(/En cours/)).toBeInTheDocument()
  })

  it('affiche l’erreur de l’API quand la suppression est refusée (409)', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockApi({
      '/api/properties': [property()],
      'DELETE /api/properties/p1': reply(409, { error: 'Ce bien a un historique de baux, il ne peut pas être supprimé' }),
    })
    renderWithProviders(<Properties />)
    fireEvent.click(await screen.findByLabelText('Supprimer T3 Lyon 3e'))
    expect(await screen.findByRole('alert')).toHaveTextContent('historique de baux')
  })
})

describe('historySegments', () => {
  const l = (id: string, startDate: string, endDate: string | null) => ({ ...lease({ id, startDate, endDate }) }) as unknown as Lease
  it('insère une période de vacance entre deux baux', () => {
    const segs = historySegments([
      l('b', '2025-03-01T00:00:00.000Z', null),
      l('a', '2024-01-01T00:00:00.000Z', '2024-12-31T00:00:00.000Z'),
    ])
    expect(segs.map(s => s.kind)).toEqual(['lease', 'vacant', 'lease'])
  })
  it('pas de vacance quand le bail suivant commence le lendemain ou le jour même', () => {
    for (const next of ['2025-01-01T00:00:00.000Z', '2024-12-31T00:00:00.000Z']) {
      const segs = historySegments([l('a', '2024-01-01T00:00:00.000Z', '2024-12-31T00:00:00.000Z'), l('b', next, null)])
      expect(segs.map(s => s.kind)).toEqual(['lease', 'lease'])
    }
  })
})
