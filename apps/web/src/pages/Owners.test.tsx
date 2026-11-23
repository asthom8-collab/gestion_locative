import { describe, it, expect } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import { Owners } from './Owners'
import { mockApi, renderWithProviders, property } from '../test/utils'

const profile = {
  id: 'u1', email: 'admin@local.dev', firstName: 'Thomas', lastName: 'Admin', role: 'ADMIN', mustChangePassword: false, hasSignature: false,
  address: null, zipCode: null, city: null, notifyDaysBefore: 60, notifyEmail: true, ntfyTopic: null, freeMobileUser: null, hasFreeMobileKey: false,
}
const users = [{ id: 'u1', firstName: 'Thomas', lastName: 'Admin', email: 'admin@local.dev' }, { id: 'u2', firstName: 'Claire', lastName: 'Copro', email: 'claire@local.dev' }]
const own = (userId: string, firstName: string, share: number, startDate: string | null, endDate: string | null) =>
  ({ id: `o-${userId}`, userId, share, startDate, endDate, user: { id: userId, firstName, lastName: userId === 'u1' ? 'Admin' : 'Copro' } })
const props = [
  property({ ownerships: [own('u1', 'Thomas', 1, null, '2020-06-30T00:00:00.000Z'), own('u2', 'Claire', 1, '2020-07-01T00:00:00.000Z', null)] }),
  property({ id: 'p2', name: 'Parking', type: 'PARKING', ownerships: [own('u1', 'Thomas', 0.5, null, null), own('u2', 'Claire', 0.5, null, null)] }),
]
const render = (route = '/owners') => renderWithProviders(<Routes><Route path="/owners" element={<Owners />} /></Routes>, route)

describe('page Propriétaires', () => {
  it('liste les propriétaires de chaque bien, avec quotes-parts, dates et statut', async () => {
    mockApi({ '/api/properties': props, '/api/me': profile, '/api/users': users })
    render('/owners?property=p2')
    const studio = (await screen.findByText('T3 Lyon 3e')).closest('.p-5') as HTMLElement
    expect(within(studio).getByText('Ancien')).toBeInTheDocument()
    expect(within(studio).getByText("Depuis toujours · jusqu'au 30 juin 2020")).toBeInTheDocument()
    expect(within(studio).getByText('Actuel')).toBeInTheDocument()
    const parking = screen.getByText('Parking').closest('.p-5') as HTMLElement
    expect(parking.className).toContain('ring-2') // bien mis en évidence par ?property=
    expect(within(parking).getAllByText('50 %')).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: /Modifier les propriétaires de Parking/ }))
    expect(await screen.findByText('Propriétaires — Parking')).toBeInTheDocument()
  })

  it('l’administrateur crée un compte de copropriétaire avec un mot de passe provisoire', async () => {
    mockApi({ '/api/properties': props, '/api/me': profile, '/api/users': users })
    render()
    fireEvent.click(await screen.findByRole('button', { name: /Nouveau compte/ }))
    fireEvent.change(screen.getByLabelText('Prénom', { selector: '.fixed input' }), { target: { value: 'Paul' } })
    fireEvent.change(screen.getByLabelText('Nom', { selector: '.fixed input' }), { target: { value: 'Durand' } })
    fireEvent.change(screen.getByLabelText('E-mail (identifiant de connexion)'), { target: { value: 'paul@local.dev' } })
    const password = (screen.getByLabelText('Mot de passe provisoire') as HTMLInputElement).value
    expect(password).toMatch(/^[A-Za-z0-9]{12}$/)
    mockApi({ '/api/properties': props, '/api/me': profile, '/api/users': users, 'POST /api/users': { ...users[0], id: 'u3', email: 'paul@local.dev' } })
    fireEvent.click(screen.getByRole('button', { name: /Créer le compte/ }))
    expect(await screen.findByRole('status')).toHaveTextContent(password)
  })

  it('un utilisateur non administrateur ne voit pas la gestion des comptes', async () => {
    mockApi({ '/api/properties': props, '/api/me': { ...profile, role: 'USER' }, '/api/users': users })
    render()
    expect(await screen.findByText('Parking')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Nouveau compte/ })).not.toBeInTheDocument()
  })
})
