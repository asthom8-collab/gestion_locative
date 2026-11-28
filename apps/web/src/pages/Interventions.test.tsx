import { describe, it, expect, vi, afterEach } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import { Interventions } from './Interventions'
import { leaseAt } from '../components/interventions/InterventionModal'
import { mockApi, renderWithProviders, property, lease } from '../test/utils'
import type { Lease } from '../types'

const render = (route = '/interventions') => renderWithProviders(<Routes><Route path="/interventions" element={<Interventions />} /></Routes>, route)

const intervention = (over: Record<string, unknown> = {}) => ({
  id: 'i1', propertyId: 'p1', leaseId: 'l1', title: 'Remplacement du chauffe-eau', kind: 'PLUMBING', date: '2026-03-12T00:00:00.000Z',
  status: 'DONE', doneBy: 'PROFESSIONAL', providerName: 'Plomberie Martin', cost: 850, paidBy: 'OWNER', fiscalNature: 'MAINTENANCE', notes: null,
  property: { id: 'p1', name: 'T3 Lyon 3e', type: 'APARTMENT', fiscalRegime: 'NU' },
  lease: { id: 'l1', tenant: { id: 't1', firstName: 'Jean', lastName: 'Dupont' } },
  documents: [{ id: 'd1', label: 'Facture 2026-042', category: 'INVOICE', mimeType: 'application/pdf' }],
  tax: { code: 'DEDUCTIBLE', label: 'Déductible des revenus fonciers', amount: 850 },
  ...over,
})
const list = (items: unknown[], totals = { ownerCost: 850, deductible: 850, depreciable: 0, planned: 0 }) => ({ items, totals, years: [2026, 2025] })
const base = { '/api/properties': [property()], '/api/leases': [lease({ tenant: { id: 't1', firstName: 'Jean', lastName: 'Dupont', email: 'j@x.fr' } })] }

afterEach(() => vi.restoreAllMocks())

describe('page Interventions', () => {
  it('liste les interventions avec le traitement fiscal, les factures et les totaux', async () => {
    mockApi({ ...base, '/api/interventions': list([intervention(), intervention({
      id: 'i2', title: 'Porte de garage', status: 'PLANNED', doneBy: 'OWNER', providerName: null, documents: [], lease: null,
      tax: { code: 'NONE', label: 'Prévue : comptera une fois faite', amount: 0 },
    })]) })
    render()
    expect(await screen.findByText('Remplacement du chauffe-eau')).toBeInTheDocument()
    expect(screen.getByText('Déductible des revenus fonciers')).toBeInTheDocument()
    expect(screen.getByText('Plomberie Martin')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'bail de Jean Dupont' })).toHaveAttribute('href', '/leases/l1')
    expect(screen.getByRole('link', { name: /Facture 2026-042/ })).toHaveAttribute('href', '/api/documents/d1/file')
    expect(screen.getByText('Prévue')).toBeInTheDocument()
    expect(screen.getByText('Moi-même')).toBeInTheDocument()
    expect(screen.getByText('Dépenses (faites, à votre charge)').previousSibling).toHaveTextContent('850,00 €')
  })

  it('filtre par bien, type et année (paramètres de l’adresse et de l’API)', async () => {
    const fetchMock = mockApi({ ...base, '/api/interventions?propertyId=p1&year=2025': list([]), '/api/interventions?propertyId=p1&kind=HEATING&year=2025': list([]) })
    render('/interventions?property=p1&year=2025')
    expect(await screen.findByText('Aucune intervention pour ces filtres')).toBeInTheDocument()
    expect(screen.getByLabelText('Filtrer par année')).toHaveDisplayValue('2025')
    fireEvent.change(screen.getByLabelText('Filtrer par type'), { target: { value: 'HEATING' } })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/interventions?propertyId=p1&kind=HEATING&year=2025', expect.anything()))
  })

  it('ajoute une intervention faite soi-même, avec le bail en cours proposé par défaut', async () => {
    const fetchMock = mockApi({ ...base, '/api/interventions': list([]), 'POST /api/interventions': intervention() })
    render()
    fireEvent.click(await screen.findByRole('button', { name: /Nouvelle intervention/ }))
    const dialog = screen.getByText('Nouvelle intervention', { selector: 'h3' }).closest('div')!.parentElement!
    const d = within(dialog)
    await d.findByRole('option', { name: 'T3 Lyon 3e' })
    fireEvent.change(d.getByLabelText('Bien'), { target: { value: 'p1' } })
    await d.findByRole('option', { name: 'Jean Dupont' })
    fireEvent.change(d.getByLabelText('Intitulé'), { target: { value: ' Peinture du séjour ' } })
    fireEvent.change(d.getByLabelText('Type de travaux'), { target: { value: 'PAINTING' } })
    fireEvent.change(d.getByLabelText('Date'), { target: { value: '2026-05-02' } })
    expect(d.getByLabelText('Pendant le bail de (facultatif)')).toHaveDisplayValue('Jean Dupont')
    fireEvent.click(d.getByRole('radio', { name: 'Moi-même' }))
    expect(d.getByText(/votre main-d’œuvre n’est jamais déductible/)).toBeInTheDocument()
    fireEvent.change(d.getByLabelText('Coût des matériaux TTC (€)'), { target: { value: '120.5' } })
    fireEvent.click(d.getByRole('radio', { name: 'Amélioration' }))
    fireEvent.click(d.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/interventions', expect.objectContaining({ method: 'POST' })))
    const body = JSON.parse(fetchMock.mock.calls.find(c => c[1]?.method === 'POST')![1]!.body as string)
    expect(body).toEqual({
      propertyId: 'p1', leaseId: 'l1', title: 'Peinture du séjour', kind: 'PAINTING', date: '2026-05-02T00:00:00.000Z', status: 'DONE',
      doneBy: 'OWNER', providerName: null, cost: 120.5, paidBy: 'OWNER', fiscalNature: 'IMPROVEMENT', notes: null,
    })
  })

  it('supprime une intervention après confirmation', async () => {
    const fetchMock = mockApi({ ...base, '/api/interventions': list([intervention()]), 'DELETE /api/interventions/i1': { __reply: true, status: 204 } })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render()
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer Remplacement du chauffe-eau' }))
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('restent dans les documents du bien'))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/interventions/i1', expect.objectContaining({ method: 'DELETE' })))
  })
})

describe('leaseAt', () => {
  const leases = [
    { id: 'old', propertyId: 'p1', startDate: '2020-01-01T00:00:00.000Z', endDate: '2024-12-31T00:00:00.000Z' },
    { id: 'cur', propertyId: 'p1', startDate: '2025-01-01T00:00:00.000Z', endDate: null },
  ] as Lease[]
  it('trouve le bail en cours à la date, sur le bien', () => {
    expect(leaseAt(leases, 'p1', '2023-06-01')?.id).toBe('old')
    expect(leaseAt(leases, 'p1', '2026-06-01')?.id).toBe('cur')
    expect(leaseAt(leases, 'p2', '2026-06-01')).toBeNull()
    expect(leaseAt(leases, 'p1', '2019-06-01')).toBeNull()
  })
})
