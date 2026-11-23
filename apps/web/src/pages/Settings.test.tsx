import { describe, it, expect } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Settings } from './Settings'
import { mockApi, renderWithProviders } from '../test/utils'

const profile = {
  id: 'u1', email: 'admin@local.dev', firstName: 'Thomas', lastName: 'Admin', role: 'ADMIN',
  address: null, zipCode: null, city: null,
  notifyDaysBefore: 60, notifyEmail: true, ntfyTopic: null, freeMobileUser: null, hasFreeMobileKey: false,
}

describe('page Paramètres', () => {
  it('charge le profil et enregistre l’adresse e-mail et l’adresse du bailleur', async () => {
    const fetchMock = mockApi({ '/api/me': profile, '/api/irl': [] })
    renderWithProviders(<Settings />)

    expect(await screen.findByDisplayValue('Thomas')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/^E-mail/), { target: { value: 'thomas@exemple.fr' } })
    fireEvent.change(screen.getByLabelText('Adresse'), { target: { value: '5 place Bellecour' } })
    fireEvent.change(screen.getByLabelText('Code postal'), { target: { value: '69002' } })
    fireEvent.change(screen.getByLabelText('Ville'), { target: { value: 'Lyon' } })
    fireEvent.click(screen.getAllByRole('button', { name: /Enregistrer/ })[0])

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/me', expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ email: 'thomas@exemple.fr', firstName: 'Thomas', lastName: 'Admin', address: '5 place Bellecour', zipCode: '69002', city: 'Lyon' }),
      }))
    )
    expect(await screen.findByText('Enregistré')).toBeInTheDocument()
  })
})

describe('page Paramètres : comptes et signature', () => {
  const admin = { ...profile, mustChangePassword: false, hasSignature: false }
  const users = [{ id: 'u1', firstName: 'Thomas', lastName: 'Admin', email: 'admin@local.dev' }]

  it('l’administrateur crée un compte (rôle propriétaire par défaut) avec un mot de passe provisoire', async () => {
    const fetchMock = mockApi({ '/api/me': admin, '/api/users': users })
    renderWithProviders(<Settings />)
    fireEvent.click(await screen.findByRole('button', { name: /Nouveau compte/ }))
    fireEvent.change(screen.getByLabelText('Prénom', { selector: '.fixed input' }), { target: { value: 'Claire' } })
    fireEvent.change(screen.getByLabelText('Nom', { selector: '.fixed input' }), { target: { value: 'Copro' } })
    fireEvent.change(screen.getByLabelText('E-mail (identifiant de connexion)'), { target: { value: 'claire@local.dev' } })
    const password = (screen.getByLabelText('Mot de passe provisoire') as HTMLInputElement).value
    expect(password).toMatch(/^[A-Za-z0-9]{12}$/)
    expect(screen.getByLabelText('Rôle')).toHaveDisplayValue(/^Propriétaire/)
    fireEvent.click(screen.getByRole('button', { name: /Créer le compte/ }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/users', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ email: 'claire@local.dev', firstName: 'Claire', lastName: 'Copro', password, role: 'USER' }),
    })))
  })

  it('l’administrateur change le rôle d’un autre compte, pas le sien', async () => {
    const fetchMock = mockApi({
      '/api/me': admin,
      '/api/users': [{ ...users[0], role: 'ADMIN' }, { id: 'u2', firstName: 'Claire', lastName: 'Copro', email: 'claire@local.dev', role: 'USER' }],
      'PUT /api/users/u2/role': { id: 'u2', role: 'ADMIN' },
    })
    renderWithProviders(<Settings />)
    const select = await screen.findByLabelText('Rôle de Claire Copro')
    expect(screen.queryByLabelText('Rôle de Thomas Admin')).not.toBeInTheDocument()
    fireEvent.change(select, { target: { value: 'ADMIN' } })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/users/u2/role', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ role: 'ADMIN' }) })))
  })

  it('un propriétaire (non administrateur) ne voit pas la gestion des comptes', async () => {
    mockApi({ '/api/me': { ...admin, role: 'USER' }, '/api/users': users })
    renderWithProviders(<Settings />)
    expect(await screen.findByText('Signature')).toBeInTheDocument()
    expect(screen.queryByText('Comptes')).not.toBeInTheDocument()
  })

  it('refuse une signature qui n’est pas une image PNG ou JPEG, sans appeler l’API', async () => {
    const fetchMock = mockApi({ '/api/me': admin, '/api/users': users })
    renderWithProviders(<Settings />)
    const input = await screen.findByLabelText('Fichier de signature')
    fireEvent.change(input, { target: { files: [new File(['<svg/>'], 'sig.svg', { type: 'image/svg+xml' })] } })
    expect(await screen.findByRole('alert')).toHaveTextContent('PNG ou JPEG')
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('signature'))).toBe(false)
  })
})
