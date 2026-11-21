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
  it('charge le profil et enregistre l’adresse du bailleur', async () => {
    const fetchMock = mockApi({ '/api/me': profile, '/api/irl': [] })
    renderWithProviders(<Settings />)

    expect(await screen.findByDisplayValue('Thomas')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Adresse'), { target: { value: '5 place Bellecour' } })
    fireEvent.change(screen.getByLabelText('Code postal'), { target: { value: '69002' } })
    fireEvent.change(screen.getByLabelText('Ville'), { target: { value: 'Lyon' } })
    fireEvent.click(screen.getAllByRole('button', { name: /Enregistrer/ })[0])

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/me', expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ firstName: 'Thomas', lastName: 'Admin', address: '5 place Bellecour', zipCode: '69002', city: 'Lyon' }),
      }))
    )
    expect(await screen.findByText('Enregistré')).toBeInTheDocument()
  })
})

describe('page Paramètres : comptes et signature', () => {
  const admin = { ...profile, mustChangePassword: false, hasSignature: false }
  const users = [{ id: 'u1', firstName: 'Thomas', lastName: 'Admin', email: 'admin@local.dev' }]

  it('l’administrateur crée un compte avec un mot de passe provisoire', async () => {
    const fetchMock = mockApi({ '/api/me': admin, '/api/users': users })
    renderWithProviders(<Settings />)
    fireEvent.click(await screen.findByRole('button', { name: /Nouveau compte/ }))
    fireEvent.change(screen.getByLabelText('Prénom', { selector: '.fixed input' }), { target: { value: 'Claire' } })
    fireEvent.change(screen.getByLabelText('Nom', { selector: '.fixed input' }), { target: { value: 'Copro' } })
    fireEvent.change(screen.getByLabelText('E-mail (identifiant de connexion)'), { target: { value: 'claire@local.dev' } })
    const password = (screen.getByLabelText('Mot de passe provisoire') as HTMLInputElement).value
    expect(password).toMatch(/^[A-Za-z0-9]{12}$/)
    mockApi({ '/api/me': admin, '/api/users': users, 'POST /api/users': { ...admin, id: 'u2', email: 'claire@local.dev' } })
    fireEvent.click(screen.getByRole('button', { name: /Créer le compte/ }))
    expect(await screen.findByRole('status')).toHaveTextContent(password)
  })

  it('un utilisateur non administrateur ne voit pas la gestion des comptes', async () => {
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

describe('page Paramètres : indices IRL', () => {
  it('liste les indices et en enregistre un', async () => {
    const fetchMock = mockApi({ '/api/me': profile, '/api/irl': [{ id: 'i1', quarter: 2, year: 2025, value: 145.6 }], 'PUT /api/irl': { id: 'i2', quarter: 3, year: 2025, value: 146 } })
    renderWithProviders(<Settings />)
    expect(await screen.findByText('T2 2025')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Trimestre'), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText('Année'), { target: { value: '2025' } })
    fireEvent.change(screen.getByLabelText('Valeur'), { target: { value: '146' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Enregistrer' }).slice(-1)[0])
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/irl', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ quarter: 3, year: 2025, value: 146 }) })))
  })
})

describe('page Paramètres : notifications', () => {
  it('enregistre le délai et les canaux, sans renvoyer la clé SMS si elle n’est pas modifiée', async () => {
    const fetchMock = mockApi({ '/api/me': { ...profile, hasFreeMobileKey: true, freeMobileUser: '123' }, '/api/irl': [], 'PATCH /api/me': profile })
    renderWithProviders(<Settings />)
    fireEvent.change(await screen.findByLabelText('Prévenir combien de jours avant l\'anniversaire du bail'), { target: { value: '45' } })
    fireEvent.change(screen.getByLabelText('Téléphone : sujet ntfy'), { target: { value: 'mon-sujet' } })
    expect(screen.getByLabelText('Clé d\'identification')).toHaveAttribute('placeholder', 'enregistrée (laisser vide pour la garder)')
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les notifications' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/me', expect.objectContaining({
      method: 'PATCH', body: JSON.stringify({ notifyDaysBefore: 45, notifyEmail: true, ntfyTopic: 'mon-sujet', freeMobileUser: '123' }),
    })))
  })

  it('envoie un essai et affiche le résultat de chaque canal', async () => {
    mockApi({ '/api/me': profile, '/api/irl': [], 'POST /api/notifications/test': { email: 'not_configured', ntfy: 'sent', sms: { error: 'SMS Free Mobile : refusé' } } })
    renderWithProviders(<Settings />)
    fireEvent.click(await screen.findByRole('button', { name: 'Envoyer un essai' }))
    const result = await screen.findByRole('list', { name: 'Résultat de l’essai' })
    expect(result).toHaveTextContent('E-mail : serveur d’e-mail (SMTP) non configuré')
    expect(result).toHaveTextContent('ntfy : envoyé')
    expect(result).toHaveTextContent('SMS : échec (SMS Free Mobile : refusé)')
  })
})
