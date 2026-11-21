import { describe, it, expect } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import { Charges } from './Charges'
import { mockApi, renderWithProviders, property, lease } from '../test/utils'

const render = () => renderWithProviders(<Routes><Route path="/charges" element={<Charges />} /></Routes>, '/charges?year=2025')
const props = [property({ leases: [lease()] }), property({ id: 'p2', name: 'Parking', type: 'PARKING', leases: [] })]

describe('page Charges', () => {
  it('liste les charges de l’année par bien, avec les liens de régularisation', async () => {
    mockApi({ '/api/properties': props, '/api/charges?year=2025': [{ id: 'c1', propertyId: 'p1', year: 2025, quarter: 2, label: 'Eau', amount: 300 }] })
    render()
    expect(await screen.findByText('Eau')).toBeInTheDocument()
    expect(screen.getByText('Total 300,00 €')).toBeInTheDocument()
    expect(screen.getByText('T2', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByText('Aucune charge saisie pour 2025.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Jean Dupont' })).toHaveAttribute('href', '/leases/l1')
  })

  it('ajoute une charge au bien', async () => {
    const fetchMock = mockApi({ '/api/properties': props, '/api/charges?year=2025': [], 'POST /api/charges': { id: 'c2' } })
    render()
    fireEvent.change(await screen.findByLabelText('Nouvelle charge pour Parking'), { target: { value: ' Entretien ' } })
    fireEvent.change(screen.getByLabelText('Montant pour Parking'), { target: { value: '120.5' } })
    fireEvent.change(screen.getByLabelText('Période pour Parking'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter à Parking' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/charges', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ propertyId: 'p2', year: 2025, quarter: 3, label: 'Entretien', amount: 120.5 }),
    })))
  })

  it('répartit les charges entre propriétaires successifs', async () => {
    mockApi({
      '/api/properties': props, '/api/charges?year=2025': [],
      '/api/charges/allocation?year=2025': [
        { propertyId: 'p1', propertyName: 'Studio', total: 1065, owners: [
          { userId: 'u1', name: 'Thomas Admin', share: 1, startDate: null, endDate: '2025-06-30T00:00:00.000Z', amount: 481 },
          { userId: 'u2', name: 'Claire Copro', share: 1, startDate: '2025-07-01T00:00:00.000Z', endDate: null, amount: 584 },
        ] },
        { propertyId: 'p2', propertyName: 'Parking', total: 100, owners: [{ userId: 'u1', name: 'Thomas Admin', share: 1, startDate: null, endDate: null, amount: 100 }] },
      ],
    })
    render()
    expect(await screen.findByText('Répartition entre propriétaires')).toBeInTheDocument()
    expect(screen.getByText('481,00 €')).toBeInTheDocument()
    expect(screen.getByText(/Claire Copro/).textContent).toContain('depuis le 01 juillet 2025')
    expect(screen.queryByText('Parking ·', { exact: false })).not.toBeInTheDocument() // un seul propriétaire : rien à répartir
  })
})
