import { describe, it, expect } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import { LeaseDetail } from './LeaseDetail'
import { mockApi, renderWithProviders, property, reply } from '../test/utils'

const detail = (over: Record<string, unknown> = {}) => ({
  id: 'l1', propertyId: 'p1', tenantId: 't1', type: 'UNFURNISHED',
  startDate: '2025-01-01T00:00:00.000Z', endDate: null, rentAmount: 800, chargesAmount: 50, rentDayOfMonth: 5,
  irlReference: 142.06, irlQuarter: 2, irlYear: 2024, active: true, createdAt: '',
  property: { ...property(), leases: undefined },
  tenant: { id: 't1', firstName: 'Jean', lastName: 'Dupont', email: 'jean@example.com', phone: '0601020304', iban: null, createdAt: '' },
  ...over,
})
const payment = (over: Record<string, unknown> = {}) => ({
  id: 'rp1', leaseId: 'l1', periodYear: 2026, periodMonth: 10,
  periodStart: '2026-10-01T00:00:00.000Z', periodEnd: '2026-10-31T00:00:00.000Z',
  rentAmount: 800, chargesAmount: 50, expectedAmount: 850, receivedAmount: null, paymentDate: null,
  status: 'LATE', dueDate: '2026-10-05T00:00:00.000Z', receipt: null,
  lease: { id: 'l1', rentDayOfMonth: 5, property: { id: 'p1', name: 'T3 Lyon 3e', address: '', city: '' }, tenant: { id: 't1', firstName: 'Jean', lastName: 'Dupont', email: '' } },
  ...over,
})

const renderDetail = () =>
  renderWithProviders(<Routes><Route path="/leases/:id" element={<LeaseDetail />} /></Routes>, '/leases/l1')

describe('fiche du bail', () => {
  it('affiche le bail, le locataire et les échéances avec leurs actions', async () => {
    mockApi({
      '/api/leases/l1': detail(),
      '/api/rent-payments?leaseId=l1': [
        payment({ id: 'rp3', periodMonth: 11, status: 'RECEIVED', receivedAmount: 850, paymentDate: '2026-11-04T00:00:00.000Z' }),
        payment({ id: 'rp2', periodMonth: 10, status: 'RECEIVED', receivedAmount: 850, paymentDate: '2026-10-03T00:00:00.000Z', receipt: { id: 'r1', rentPaymentId: 'rp2', filePath: 'x', sentAt: null, createdAt: '' } }),
        payment(),
      ],
    })
    renderDetail()
    expect(await screen.findByRole('heading', { name: 'Jean Dupont' })).toBeInTheDocument()
    expect(screen.getByText('le 5 du mois')).toBeInTheDocument()
    expect(screen.getByText('142.06 (T2 2024)')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /0601020304/ })).toHaveAttribute('href', 'tel:0601020304')

    expect(await screen.findByRole('button', { name: /Établir la quittance/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Quittance$/ })).toHaveAttribute('href', '/api/rent-payments/rp2/receipt')
    // Une échéance non payée renvoie vers la page Loyers du mois concerné
    expect(screen.getByRole('link', { name: /Encaisser/ })).toHaveAttribute('href', '/rents?year=2026&month=10')
  })

  it('résilie le bail avec la date choisie, et affiche le refus de l’API', async () => {
    const fetchMock = mockApi({
      '/api/leases/l1': detail(),
      '/api/rent-payments?leaseId=l1': [],
      'POST /api/leases/l1/terminate': reply(400, { error: 'La date de fin ne peut pas précéder le début du bail' }),
    })
    renderDetail()
    fireEvent.click(await screen.findByRole('button', { name: /Résilier le bail/ }))
    fireEvent.change(screen.getByLabelText('Date de fin (incluse)'), { target: { value: '2024-06-30' } })
    fireEvent.click(screen.getByRole('button', { name: /Confirmer la résiliation/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('précéder le début')
    const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!
    expect(JSON.parse(call[1]!.body as string)).toEqual({ endDate: '2024-06-30T00:00:00.000Z' })
  })

  it('envoie seulement les champs modifiables lors de la modification', async () => {
    const fetchMock = mockApi({
      '/api/leases/l1': detail(),
      '/api/rent-payments?leaseId=l1': [],
      'PATCH /api/leases/l1': detail({ rentAmount: 820 }),
    })
    renderDetail()
    fireEvent.click(await screen.findByLabelText('Modifier le bail'))
    fireEvent.change(screen.getByLabelText('Loyer hors charges (€)'), { target: { value: '820' } })
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer/ }))
    await waitFor(() => expect(screen.queryByText('Modifier le bail', { selector: 'h3' })).not.toBeInTheDocument())
    const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH')!
    expect(JSON.parse(call[1]!.body as string)).toEqual({ type: 'UNFURNISHED', rentAmount: 820, chargesAmount: 50, rentDayOfMonth: 5 })
  })

  it('affiche une erreur pour un bail inconnu', async () => {
    mockApi({ '/api/leases/l1': reply(404, { error: 'Bail introuvable' }), '/api/rent-payments?leaseId=l1': [] })
    renderDetail()
    expect(await screen.findByRole('alert')).toHaveTextContent('Bail introuvable')
  })
})
