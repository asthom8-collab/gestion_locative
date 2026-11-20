import { describe, it, expect } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from './App'
import { mockApi, reply } from './test/utils'

const now = new Date()
const rentsPath = `/api/rent-payments?year=${now.getFullYear()}&month=${now.getMonth() + 1}`
const profile = (over: Record<string, unknown> = {}) => ({
  id: 'u1', email: 'admin@local.dev', firstName: 'Thomas', lastName: 'Admin', role: 'ADMIN',
  address: null, zipCode: null, city: null, mustChangePassword: false, hasSignature: false, ...over,
})
const empty = { '/api/properties': [], '/api/tenants': [], '/api/leases': [], [rentsPath]: [] }

// Vérifie que chaque page se monte sans erreur dans l'application complète (utilisateur connecté).
describe.each([
  ['/', 'Tableau de bord'],
  ['/properties', 'Mes biens'],
  ['/tenants', 'Mes locataires'],
  ['/rents', 'Loyers'],
  ['/settings', 'Paramètres'],
])('route %s', (path, title) => {
  it(`affiche « ${title} »`, async () => {
    mockApi({ '/api/me': profile(), '/api/users': [], ...empty })
    window.history.pushState({}, '', path)
    render(<App />)
    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument()
  })
})

describe('route /leases', () => {
  it('demande de créer un bien et un locataire quand il n’y en a pas', async () => {
    mockApi({ '/api/me': profile(), ...empty })
    window.history.pushState({}, '', '/leases')
    render(<App />)
    expect(await screen.findByText('Créez d\'abord un bien et un locataire')).toBeInTheDocument()
  })
})

describe('connexion', () => {
  it('sans session : écran de connexion, puis l’application une fois connecté', async () => {
    const fetchMock = mockApi({ '/api/me': reply(401, { error: 'Connexion requise' }), 'POST /api/auth/login': profile(), ...empty })
    window.history.pushState({}, '', '/')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument()
    expect(screen.queryByText('Tableau de bord')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: ' admin@local.dev ' } })
    fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }))
    expect(await screen.findByRole('heading', { name: 'Tableau de bord' })).toBeInTheDocument()
    const call = fetchMock.mock.calls.find(([url]) => url === '/api/auth/login')!
    expect(JSON.parse(call[1]!.body as string)).toEqual({ email: 'admin@local.dev', password: 'secret' })
  })

  it('affiche le refus de l’API (mauvais mot de passe)', async () => {
    mockApi({ '/api/me': reply(401, { error: 'Connexion requise' }), 'POST /api/auth/login': reply(401, { error: 'E-mail ou mot de passe incorrect' }) })
    render(<App />)
    fireEvent.change(await screen.findByLabelText('E-mail'), { target: { value: 'a@b.fr' } })
    fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: 'faux' } })
    fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou mot de passe incorrect')
  })

  it('mot de passe provisoire : changement obligatoire avant d’accéder à l’application', async () => {
    mockApi({
      '/api/me': profile({ mustChangePassword: true }),
      'PUT /api/me/password': profile({ mustChangePassword: false }),
      ...empty,
    })
    window.history.pushState({}, '', '/')
    render(<App />)
    expect(await screen.findByText(/mot de passe provisoire/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Mot de passe actuel'), { target: { value: 'provisoire' } })
    fireEvent.change(screen.getByLabelText(/Nouveau mot de passe/), { target: { value: 'court' } })
    fireEvent.change(screen.getByLabelText('Confirmer le nouveau mot de passe'), { target: { value: 'court' } })
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer et continuer/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('au moins 8 caractères')

    fireEvent.change(screen.getByLabelText(/Nouveau mot de passe/), { target: { value: 'mon-mot-de-passe' } })
    fireEvent.change(screen.getByLabelText('Confirmer le nouveau mot de passe'), { target: { value: 'mon-mot-de-passe' } })
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer et continuer/ }))
    expect(await screen.findByRole('heading', { name: 'Tableau de bord' })).toBeInTheDocument()
  })

  it('la déconnexion ramène à l’écran de connexion', async () => {
    let loggedIn = true
    const routes = { ...empty, 'POST /api/auth/logout': reply(204) } as Record<string, unknown>
    const fetchMock = mockApi(routes)
    // /api/me répond selon l'état de la session
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input)
      if (path === '/api/me') return loggedIn
        ? new Response(JSON.stringify(profile()), { status: 200 })
        : new Response(JSON.stringify({ error: 'Connexion requise' }), { status: 401 })
      if (path === '/api/auth/logout') { loggedIn = false; return new Response(null, { status: 204 }) }
      const body = routes[path] ?? []
      return new Response(JSON.stringify(body), { status: 200 })
    })
    window.history.pushState({}, '', '/')
    render(<App />)
    await screen.findByRole('heading', { name: 'Tableau de bord' })
    fireEvent.click(screen.getByLabelText('Se déconnecter'))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Connexion' })).toBeInTheDocument())
  })
})
