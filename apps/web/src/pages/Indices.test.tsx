import { describe, it, expect } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Indices } from './Indices'
import { mockApi, renderWithProviders } from '../test/utils'

const indexes = [
  { id: 'i2', quarter: 4, year: 2025, value: 145.78, source: 'INSEE', publishedAt: '2026-01-16T00:00:00.000Z' },
  { id: 'i1', quarter: 4, year: 2024, value: 144.64, source: 'MANUAL', publishedAt: null },
]

describe('page Indices IRL', () => {
  it('liste les indices avec la valeur, l’évolution sur un an et la source', async () => {
    mockApi({ '/api/irl': indexes, '/api/irl/sync': { checkedAt: '2026-11-23T08:00:00.000Z', added: 0, corrected: 0, latest: { year: 2025, quarter: 4 } } })
    renderWithProviders(<Indices />)
    const row = (await screen.findByText('T4 2025')).closest('tr')!
    expect(row).toHaveTextContent('145,78')
    expect(row).toHaveTextContent('+0,79 %')
    expect(row).toHaveTextContent('INSEE, JO du 16 janvier 2026')
    expect(screen.getByText('T4 2024').closest('tr')).toHaveTextContent('Saisi à la main')
    expect(screen.getByRole('status')).toHaveTextContent(/dernier indice publié : T4 2025.*Rien de nouveau/)
  })

  it('vérifie les indices auprès de l’INSEE à la demande', async () => {
    const fetchMock = mockApi({ '/api/irl': [], '/api/irl/sync': null, 'POST /api/irl/sync': { checkedAt: '2026-11-23T08:00:00.000Z', added: 2, corrected: 0, latest: { year: 2026, quarter: 3 } } })
    renderWithProviders(<Indices />)
    fireEvent.click(await screen.findByRole('button', { name: /Vérifier maintenant/ }))
    expect(await screen.findByRole('status')).toHaveTextContent('2 indices ajoutés')
    expect(fetchMock).toHaveBeenCalledWith('/api/irl/sync', expect.objectContaining({ method: 'POST' }))
  })

  it('enregistre un indice saisi à la main', async () => {
    const fetchMock = mockApi({ '/api/irl': [], '/api/irl/sync': null, 'PUT /api/irl': { id: 'i3', quarter: 3, year: 2025, value: 146, source: 'MANUAL', publishedAt: null } })
    renderWithProviders(<Indices />)
    fireEvent.click(await screen.findByText('Saisir un indice à la main'))
    fireEvent.change(screen.getByLabelText('Trimestre'), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText('Année'), { target: { value: '2025' } })
    fireEvent.change(screen.getByLabelText('Valeur'), { target: { value: '146' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/irl', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ quarter: 3, year: 2025, value: 146 }) })))
  })
})
