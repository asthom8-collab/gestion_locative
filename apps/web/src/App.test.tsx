import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'
import { mockApi } from './test/utils'

const now = new Date()
const rentsPath = `/api/rent-payments?year=${now.getFullYear()}&month=${now.getMonth() + 1}`

// Vérifie que chaque page se monte sans erreur dans l'application complète.
// Attention : App a un QueryClient global, le cache est partagé entre ces tests (données vides partout).
describe.each([
  ['/', 'Tableau de bord'],
  ['/properties', 'Mes biens'],
  ['/tenants', 'Mes locataires'],
  ['/rents', 'Loyers'],
])('route %s', (path, title) => {
  it(`affiche « ${title} »`, async () => {
    mockApi({ '/api/properties': [], '/api/tenants': [], '/api/leases': [], [rentsPath]: [] })
    window.history.pushState({}, '', path)
    render(<App />)
    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument()
  })
})

describe('route /leases', () => {
  it('demande de créer un bien et un locataire quand il n’y en a pas', async () => {
    mockApi({ '/api/properties': [], '/api/tenants': [], '/api/leases': [] })
    window.history.pushState({}, '', '/leases')
    render(<App />)
    expect(await screen.findByText('Créez d\'abord un bien et un locataire')).toBeInTheDocument()
  })

})
