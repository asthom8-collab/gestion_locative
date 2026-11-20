import { describe, it, expect } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { Tenants } from './Tenants'
import { mockApi, renderWithProviders, lease, reply } from '../test/utils'

const tenant = (over: Record<string, unknown> = {}) => ({
  id: 't1', firstName: 'Jean', lastName: 'Dupont', email: 'jean@example.com', phone: '0601020304', iban: null,
  createdAt: '', leases: [], ...over,
})
const tenantLease = (over: Record<string, unknown> = {}) =>
  lease({ property: { id: 'p1', name: 'T3 Lyon 3e', city: 'Lyon' }, tenant: undefined, ...over })

describe('page Locataires', () => {
  it('sépare les locataires en cours des anciens', async () => {
    mockApi({
      '/api/tenants': [
        tenant({ leases: [tenantLease()] }),
        tenant({ id: 't2', firstName: 'Anne', lastName: 'Martin', leases: [tenantLease({ id: 'l2', active: false, endDate: '2025-06-30T00:00:00.000Z' })] }),
        tenant({ id: 't3', firstName: 'Paul', lastName: 'Nouveau' }),
      ],
    })
    renderWithProviders(<Tenants />)
    expect(await screen.findByText('Jean Dupont')).toBeInTheDocument()
    expect(screen.queryByText('Anne Martin')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /T3 Lyon 3e/ })).toHaveAttribute('href', '/leases/l1')

    fireEvent.click(screen.getByRole('tab', { name: /Anciens et sans bail/ }))
    expect(screen.getByText('Anne Martin')).toBeInTheDocument()
    expect(screen.getByText('Paul Nouveau')).toBeInTheDocument()
    expect(screen.queryByText('Jean Dupont')).not.toBeInTheDocument()
    expect(screen.getByText('Historique des baux')).toBeInTheDocument()
  })

  it('garde la fenêtre ouverte et affiche l’erreur de validation de l’API (400)', async () => {
    mockApi({
      '/api/tenants': [],
      'POST /api/tenants': reply(400, { error: 'E-mail invalide' }),
    })
    renderWithProviders(<Tenants />)
    fireEvent.click((await screen.findAllByRole('button', { name: /Ajouter/ }))[0])
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer/ }))
    const dialog = (await screen.findByRole('alert')).closest('div.bg-white') as HTMLElement
    expect(within(dialog).getByText('E-mail invalide')).toBeInTheDocument()
    expect(screen.getByText('Nouveau locataire')).toBeInTheDocument()
  })
})
