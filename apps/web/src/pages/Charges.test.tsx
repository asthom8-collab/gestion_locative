import { describe, it, expect } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import { Charges } from './Charges'
import { mockApi, renderWithProviders, property, lease } from '../test/utils'

const render = () => renderWithProviders(<Routes><Route path="/charges" element={<Charges />} /></Routes>, '/charges?year=2025')
const props = [property({ leases: [lease()] }), property({ id: 'p2', name: 'Parking', type: 'PARKING', leases: [] })]

describe('page Charges', () => {
  it('liste les charges de l’année par bien, avec les liens de régularisation', async () => {
    mockApi({ '/api/properties': props, '/api/charges?year=2025': [{ id: 'c1', propertyId: 'p1', year: 2025, label: 'Eau', amount: 300 }] })
    render()
    expect(await screen.findByText('Eau')).toBeInTheDocument()
    expect(screen.getByText('Total 300,00 €')).toBeInTheDocument()
    expect(screen.getByText('Aucune charge saisie pour 2025.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Jean Dupont' })).toHaveAttribute('href', '/leases/l1')
  })

  it('ajoute une charge au bien', async () => {
    const fetchMock = mockApi({ '/api/properties': props, '/api/charges?year=2025': [], 'POST /api/charges': { id: 'c2' } })
    render()
    fireEvent.change(await screen.findByLabelText('Nouvelle charge pour Parking'), { target: { value: ' Entretien ' } })
    fireEvent.change(screen.getByLabelText('Montant pour Parking'), { target: { value: '120.5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter à Parking' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/charges', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ propertyId: 'p2', year: 2025, label: 'Entretien', amount: 120.5 }),
    })))
  })
})
