import { describe, it, expect, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Documents } from './Documents'
import { mockApi, renderWithProviders } from '../test/utils'

const lyon = { id: 'p1', name: 'T3 Lyon 3e' }
const doc = (over: Record<string, unknown> = {}) => ({
  id: 'd1', label: 'Bail signé.pdf', fileName: 'Bail signé.pdf', mimeType: 'application/pdf', size: 250_000,
  category: 'LEASE_CONTRACT', leaseId: 'l1', propertyId: null, createdAt: '2026-11-20T10:00:00.000Z', property: null,
  lease: { id: 'l1', startDate: '2025-09-01T00:00:00.000Z', endDate: null, active: true, property: lyon, tenant: { id: 't1', firstName: 'Jean', lastName: 'Dupont' } },
  ...over,
})
const dpe = doc({ id: 'd2', label: 'DPE', mimeType: 'image/png', size: 3_500_000, category: 'DIAGNOSTIC', leaseId: null, propertyId: 'p1', property: lyon, lease: null })
const properties = [{ id: 'p1', name: 'T3 Lyon 3e', address: '', zipCode: '', city: '', type: 'APARTMENT', ownerships: [], leases: [] }]
const leases = [{ id: 'l1', propertyId: 'p1', tenantId: 't1', active: true, startDate: '2025-09-01T00:00:00.000Z', endDate: null,
  property: lyon, tenant: { id: 't1', firstName: 'Jean', lastName: 'Dupont', email: '' } }]

const base = { '/api/properties': properties, '/api/leases': leases }

describe('page Documents', () => {
  it('liste les documents avec leur type, leur rattachement et les liens vers le fichier', async () => {
    mockApi({ ...base, '/api/documents': [doc(), dpe] })
    renderWithProviders(<Documents />)

    const link = (await screen.findByText('Bail signé.pdf')).closest('a')!
    expect(link).toHaveAttribute('href', '/api/documents/d1/file')
    expect(link).toHaveAttribute('target', '_blank')
    expect(screen.getByText(/Contrat de bail · Bail de Jean Dupont · T3 Lyon 3e · 20 novembre 2026 · 244 Ko/)).toBeInTheDocument()
    expect(screen.getByText(/Diagnostics .* · Bien : T3 Lyon 3e · .* · 3,3 Mo/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Télécharger DPE' })).toHaveAttribute('href', '/api/documents/d2/file?download')
  })

  it('filtre par bien (lien depuis la page Biens) et par type', async () => {
    const fetchMock = mockApi({ ...base, '/api/documents?propertyId=p1': [dpe], '/api/documents?propertyId=p1&category=DIAGNOSTIC': [dpe] })
    renderWithProviders(<Documents />, '/documents?property=p1')
    expect(await screen.findByText('DPE')).toBeInTheDocument()
    expect(screen.getByText(/bien et baux de ce bien/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'DIAGNOSTIC' } })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/documents?propertyId=p1&category=DIAGNOSTIC', expect.anything()))
  })

  it('envoie un fichier rattaché au bien choisi, avec son type', async () => {
    const fetchMock = mockApi({ ...base, '/api/documents': [], 'POST /api/documents?propertyId=p1&category=DIAGNOSTIC&fileName=dpe.pdf': dpe })
    renderWithProviders(<Documents />)
    fireEvent.click(await screen.findByRole('button', { name: /Ajouter/ }))

    const send = screen.getByRole('button', { name: /Envoyer/ })
    expect(send).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Rattacher à'), { target: { value: 'property:p1' } })
    // Pour un bien, les diagnostics sont proposés en premier
    expect(screen.getByLabelText('Type de document')).toHaveValue('DIAGNOSTIC')
    const file = new File(['%PDF-1.4'], 'dpe.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText(/Fichier/), { target: { files: [file] } })
    fireEvent.click(send)

    await waitFor(() => expect(screen.queryByRole('button', { name: /Envoyer/ })).not.toBeInTheDocument())
    const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!
    expect(call[0]).toBe('/api/documents?propertyId=p1&category=DIAGNOSTIC&fileName=dpe.pdf')
    expect(call[1]?.body).toBe(file)
    expect((call[1]?.headers as Record<string, string>)['Content-Type']).toBe('application/pdf')
  })

  it('refuse un fichier de plus de 15 Mo avant envoi', async () => {
    mockApi({ ...base, '/api/documents': [] })
    renderWithProviders(<Documents />)
    fireEvent.click(await screen.findByRole('button', { name: /Ajouter/ }))
    const big = new File(['x'], 'gros.pdf', { type: 'application/pdf' })
    Object.defineProperty(big, 'size', { value: 16 * 1024 * 1024 })
    fireEvent.change(screen.getByLabelText(/Fichier/), { target: { files: [big] } })
    expect(screen.getByRole('alert')).toHaveTextContent(/trop lourd/)
  })

  it('supprime un document après confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const fetchMock = mockApi({ ...base, '/api/documents': [doc()], 'DELETE /api/documents/d1': { __reply: true, status: 204 } })
    renderWithProviders(<Documents />)
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer Bail signé.pdf' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/documents/d1', expect.objectContaining({ method: 'DELETE' })))
  })
})
