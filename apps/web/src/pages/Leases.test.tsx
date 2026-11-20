import { describe, it, expect } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { Leases } from './Leases'
import { mockApi, renderWithProviders, property, lease, reply } from '../test/utils'

const tenants = [{ id: 't1', firstName: 'Jean', lastName: 'Dupont', email: 'jean@example.com', leases: [] }]

describe('page Baux', () => {
  it('liste les baux (actifs d’abord) avec un lien vers la fiche', async () => {
    mockApi({
      '/api/properties': [property()],
      '/api/tenants': tenants,
      '/api/leases': [
        lease({ id: 'old', active: false, startDate: '2020-01-01T00:00:00.000Z', endDate: '2023-12-31T00:00:00.000Z', property: { id: 'p1', name: 'Ancien bail', address: '', city: '' } }),
        lease(),
      ],
    })
    renderWithProviders(<Leases />)
    expect(await screen.findByRole('heading', { name: 'Mes baux' })).toBeInTheDocument()
    const links = screen.getAllByRole('link')
    expect(links.map(a => a.getAttribute('href'))).toEqual(['/leases/l1', '/leases/old'])
    expect(links[1]).toHaveTextContent('Terminé')
    expect(links[1]).toHaveTextContent('3 ans')
  })

  it('ne propose que les biens vacants et affiche l’erreur de l’API à la création', async () => {
    mockApi({
      '/api/properties': [property({ leases: [lease()] }), property({ id: 'p2', name: 'Studio vacant' })],
      '/api/tenants': tenants,
      '/api/leases': [],
      'POST /api/leases': reply(400, { error: 'Loyer invalide' }),
    })
    renderWithProviders(<Leases />)
    fireEvent.click((await screen.findAllByRole('button', { name: /Nouveau bail/ }))[0])
    const select = screen.getByLabelText('Bien (vacants uniquement)')
    expect([...select.querySelectorAll('option')].map(o => o.textContent)).toEqual(['— choisir —', 'Studio vacant'])
    fireEvent.click(screen.getByRole('button', { name: /Créer le bail/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Loyer invalide')
  })
})
