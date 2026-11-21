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

const revisionPreview = (over: Record<string, unknown> = {}) => ({
  leaseId: 'l1', currentRent: 800, nextRevisionDate: '2099-01-01T00:00:00.000Z', effectiveDate: '2027-01-01T00:00:00.000Z',
  lastRevisionDate: null, missing: null, reference: { value: 140, quarter: 2, year: 2024 },
  newIndex: { value: 145.6, quarter: 2, year: 2025 }, expectedIndex: { quarter: 2, year: 2025 }, computedRent: 832, ...over,
})
const regYear = new Date().getFullYear() - 1
const regPreview = (over: Record<string, unknown> = {}) => ({
  year: regYear, occupiedDays: 365, daysInYear: 365, charges: [{ id: 'c1', label: 'Eau', amount: 730, share: 730 }],
  totalCharges: 730, totalReal: 730, totalCharged: 600, balance: 130, missingMonths: [], suggestedMonthlyCharges: 60.83, existing: null, ...over,
})
// Routes des cartes Révision et Régularisation
const phase4 = (over: Record<string, unknown> = {}) => ({
  '/api/leases/l1/revisions/preview': revisionPreview(),
  '/api/leases/l1/revisions': [],
  [`/api/leases/l1/regularizations/preview?year=${regYear}`]: regPreview(),
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
      ...phase4(),
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
      ...phase4(),
      'PATCH /api/leases/l1': detail({ rentAmount: 820 }),
    })
    renderDetail()
    fireEvent.click(await screen.findByLabelText('Modifier le bail'))
    fireEvent.change(screen.getByLabelText('Loyer hors charges (€)'), { target: { value: '820' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(screen.queryByText('Modifier le bail', { selector: 'h3' })).not.toBeInTheDocument())
    const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH')!
    expect(JSON.parse(call[1]!.body as string)).toEqual({ type: 'UNFURNISHED', rentAmount: 820, chargesAmount: 50, rentDayOfMonth: 5, irlReference: 142.06, irlQuarter: 2, irlYear: 2024 })
  })

  it('affiche une erreur pour un bail inconnu', async () => {
    mockApi({ '/api/leases/l1': reply(404, { error: 'Bail introuvable' }), '/api/rent-payments?leaseId=l1': [] })
    renderDetail()
    expect(await screen.findByRole('alert')).toHaveTextContent('Bail introuvable')
  })

  it('révise le loyer : proposition, montant choisi, puis avis de révision', async () => {
    const revision = { id: 'r1', leaseId: 'l1', effectiveDate: '2027-01-01T00:00:00.000Z', previousRent: 800, newRent: 830, previousIrlValue: 140, previousIrlQuarter: 2, previousIrlYear: 2024, newIrlValue: 145.6, newIrlYear: 2025, createdAt: '' }
    const fetchMock = mockApi({ '/api/leases/l1': detail(), '/api/rent-payments?leaseId=l1': [], ...phase4(), 'POST /api/leases/l1/revisions': revision })
    renderDetail()
    expect(await screen.findByText(/Prochaine révision possible/)).toHaveTextContent('01 janvier 2099')
    fireEvent.click(screen.getByRole('button', { name: 'Réviser le loyer' }))
    expect(await screen.findByText('Loyer révisé (maximum)')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Nouveau loyer hors charges (€)'), { target: { value: '830' } })
    fireEvent.click(screen.getByRole('button', { name: /Appliquer la révision/ }))
    expect(await screen.findByRole('link', { name: /Avis de révision/ })).toHaveAttribute('href', '/api/leases/l1/revisions/r1/letter')
    expect(screen.getByRole('link', { name: /messagerie/ }).getAttribute('href')).toMatch(/^mailto:jean@example\.com\?subject=/)
    const call = fetchMock.mock.calls.find(([url, init]) => url === '/api/leases/l1/revisions' && init?.method === 'POST')!
    expect(JSON.parse(call[1]!.body as string)).toEqual({ effectiveDate: '2027-01-01T00:00:00.000Z', newRent: 830 })
  })

  it('révision en retard : possible dès maintenant', async () => {
    mockApi({ '/api/leases/l1': detail(), '/api/rent-payments?leaseId=l1': [], ...phase4({ '/api/leases/l1/revisions/preview': revisionPreview({ nextRevisionDate: '2024-07-01T00:00:00.000Z' }) }) })
    renderDetail()
    expect(await screen.findByText(/dès maintenant/)).toBeInTheDocument()
  })

  it('révision : propose de saisir l’indice manquant', async () => {
    const fetchMock = mockApi({
      '/api/leases/l1': detail(), '/api/rent-payments?leaseId=l1': [],
      ...phase4({ '/api/leases/l1/revisions/preview': revisionPreview({ missing: 'INDEX', newIndex: null, computedRent: null }) }),
      'PUT /api/irl': { id: 'i1', quarter: 2, year: 2025, value: 145.6 },
    })
    renderDetail()
    fireEvent.click(await screen.findByRole('button', { name: 'Réviser le loyer' }))
    fireEvent.change(await screen.findByLabelText('IRL T2 2025'), { target: { value: '145.6' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([u, i]) => u === '/api/irl' && i?.method === 'PUT')).toBe(true))
    const call = fetchMock.mock.calls.find(([u, i]) => u === '/api/irl' && i?.method === 'PUT')!
    expect(JSON.parse(call[1]!.body as string)).toEqual({ quarter: 2, year: 2025, value: 145.6 })
  })

  it('révision impossible sans IRL de référence : renvoie vers la modification du bail', async () => {
    mockApi({ '/api/leases/l1': detail(), '/api/rent-payments?leaseId=l1': [], ...phase4({ '/api/leases/l1/revisions/preview': revisionPreview({ missing: 'REFERENCE', reference: null }) }) })
    renderDetail()
    fireEvent.click(await screen.findByRole('button', { name: 'Modifier le bail' }))
    expect(await screen.findByLabelText('IRL de référence')).toHaveValue(142.06)
  })

  it('régularisation des charges : affiche le solde et l’enregistre', async () => {
    const fetchMock = mockApi({
      '/api/leases/l1': detail(), '/api/rent-payments?leaseId=l1': [], ...phase4(),
      'POST /api/leases/l1/regularizations': { id: 'g1', year: regYear },
    })
    renderDetail()
    expect(await screen.findByText('Reste à payer par le locataire')).toBeInTheDocument()
    expect(screen.getByText(/elle serait de 60,83/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer la régularisation/ }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([u, i]) => u === '/api/leases/l1/regularizations' && i?.method === 'POST')).toBe(true))
  })

  it('régularisation déjà enregistrée : lien vers le décompte', async () => {
    mockApi({
      '/api/leases/l1': detail(), '/api/rent-payments?leaseId=l1': [],
      ...phase4({ [`/api/leases/l1/regularizations/preview?year=${regYear}`]: regPreview({ existing: { id: 'g1', leaseId: 'l1', year: regYear, occupiedDays: 365, daysInYear: 365, totalCharged: 600, totalReal: 730, balance: 130, sentAt: null, createdAt: '2026-02-01T00:00:00.000Z' } }) }),
    })
    renderDetail()
    expect(await screen.findByRole('link', { name: /Décompte/ })).toHaveAttribute('href', '/api/leases/l1/regularizations/g1/statement')
  })
})
