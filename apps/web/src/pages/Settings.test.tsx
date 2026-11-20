import { describe, it, expect } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Settings } from './Settings'
import { mockApi, renderWithProviders } from '../test/utils'

const profile = {
  id: 'u1', email: 'admin@local.dev', firstName: 'Thomas', lastName: 'Admin', role: 'ADMIN',
  address: null, zipCode: null, city: null,
}

describe('page Paramètres', () => {
  it('charge le profil et enregistre l’adresse du bailleur', async () => {
    const fetchMock = mockApi({ '/api/me': profile })
    renderWithProviders(<Settings />)

    expect(await screen.findByDisplayValue('Thomas')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Adresse'), { target: { value: '5 place Bellecour' } })
    fireEvent.change(screen.getByLabelText('Code postal'), { target: { value: '69002' } })
    fireEvent.change(screen.getByLabelText('Ville'), { target: { value: 'Lyon' } })
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer/ }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/me', expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ firstName: 'Thomas', lastName: 'Admin', address: '5 place Bellecour', zipCode: '69002', city: 'Lyon' }),
      }))
    )
    expect(await screen.findByText('Enregistré')).toBeInTheDocument()
  })
})
