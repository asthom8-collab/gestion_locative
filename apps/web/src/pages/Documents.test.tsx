import { describe, it, expect, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Documents } from './Documents'
import { mockApi, renderWithProviders } from '../test/utils'

const lyon = { id: 'p1', name: 'T3 Lyon 3e' }
const doc = (over: Record<string, unknown> = {}) => ({
  id: 'd1', label: 'Bail signé.pdf', fileName: 'Bail signé.pdf', mimeType: 'application/pdf', size: 250_000,
  category: 'LEASE_CONTRACT', leaseId: 'l1', propertyId: null, createdAt: '2026-11-20T10:00:00.000Z', property: null,
  lease: { id: 'l1', startDate: '2025-09-01T00:00:00.000Z', endDate: null, active: true, property: lyon, tenant: { id: 't1', firstName: 'Jean', lastName: 'Dupont' } },
  ...over,
})
const edl = doc({ id: 'd3', label: 'EDL entrée', category: 'INVENTORY_ENTRY' })
const dpe = doc({ id: 'd2', label: 'DPE', mimeType: 'image/png', size: 3_500_000, category: 'DIAGNOSTIC', leaseId: null, propertyId: 'p1', property: lyon, lease: null })
const properties = [
  { id: 'p1', name: 'T3 Lyon 3e', address: '12 rue de la République', zipCode: '69003', city: 'Lyon', type: 'APARTMENT', ownerships: [], leases: [] },
  { id: 'p2', name: 'Studio Paris', address: '1 rue X', zipCode: '75001', city: 'Paris', type: 'APARTMENT', ownerships: [], leases: [] },
]
const leases = [
  { id: 'l1', propertyId: 'p1', tenantId: 't1', active: true, startDate: '2025-09-01T00:00:00.000Z', endDate: null,
    property: lyon, tenant: { id: 't1', firstName: 'Jean', lastName: 'Dupont', email: '' } },
  { id: 'l0', propertyId: 'p1', tenantId: 't0', active: false, startDate: '2022-01-01T00:00:00.000Z', endDate: '2025-06-30T00:00:00.000Z',
    property: lyon, tenant: { id: 't0', firstName: 'Anne', lastName: 'Martin', email: '' } },
]
const routes = (docs: unknown[] = [doc(), edl, dpe]) => ({ '/api/properties': properties, '/api/leases': leases, '/api/documents': docs })

describe('page Documents', () => {
  it('affiche des tuiles de biens et de baux (en cours, terminés) avec le nombre de documents', async () => {
    mockApi(routes())
    renderWithProviders(<Documents />)

    const biens = await screen.findByRole('region', { name: 'Biens' })
    const lyonTile = within(biens).getByRole('link', { name: /T3 Lyon 3e/ })
    expect(lyonTile).toHaveAttribute('href', '/documents?property=p1')
    expect(lyonTile).toHaveTextContent('1 document')
    expect(within(biens).getByRole('link', { name: /Studio Paris/ })).toHaveTextContent('Aucun document')

    const baux = screen.getByRole('region', { name: 'Baux' })
    expect(within(baux).getByRole('link', { name: /Bail de Jean Dupont/ })).toHaveTextContent('2 documents')
    expect(within(baux).getByText('Baux terminés')).toBeInTheDocument()
    expect(within(baux).getByRole('link', { name: /Bail de Anne Martin/ })).toHaveAttribute('href', '/documents?lease=l0')
  })

  it('ouvre le dossier d’un bail : documents rangés par type, filtre par boutons', async () => {
    mockApi(routes())
    renderWithProviders(<Documents />, '/documents?lease=l1')

    expect(await screen.findByRole('heading', { name: 'Bail de Jean Dupont' })).toBeInTheDocument()
    const contrat = screen.getByRole('region', { name: 'Contrat de bail' })
    const link = within(contrat).getByText('Bail signé.pdf').closest('a')!
    expect(link).toHaveAttribute('href', '/api/documents/d1/file')
    expect(link).toHaveAttribute('target', '_blank')
    expect(screen.getByRole('region', { name: "État des lieux d'entrée" })).toBeInTheDocument()
    expect(screen.queryByText('DPE')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: "État des lieux d'entrée (1)" }))
    expect(screen.queryByRole('region', { name: 'Contrat de bail' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tous (2)' }))
    expect(screen.getByRole('region', { name: 'Contrat de bail' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tous les documents' })).toHaveAttribute('href', '/documents')
  })

  it('ouvre le dossier d’un bien, avec ses baux en tuiles', async () => {
    mockApi(routes())
    renderWithProviders(<Documents />, '/documents?property=p1')
    expect(await screen.findByRole('heading', { name: 'T3 Lyon 3e' })).toBeInTheDocument()
    expect(screen.getByText('DPE')).toBeInTheDocument()
    expect(screen.getByText(/3,3 Mo/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Télécharger DPE' })).toHaveAttribute('href', '/api/documents/d2/file?download')
    const baux = screen.getByRole('region', { name: 'Baux de ce bien' })
    expect(within(baux).getAllByRole('link')).toHaveLength(2)
  })

  it('ajoute un document au bien ouvert, type choisi par bouton', async () => {
    const fetchMock = mockApi({ ...routes([]), 'POST /api/documents?propertyId=p2&category=PROPERTY_TAX&fileName=tf.pdf': dpe })
    renderWithProviders(<Documents />, '/documents?property=p2')
    fireEvent.click(await screen.findByRole('button', { name: /^Ajouter$/ }))

    const send = screen.getByRole('button', { name: /Envoyer/ })
    expect(send).toBeDisabled()
    // Pour un bien, les diagnostics sont proposés en premier
    expect(screen.getByRole('radio', { name: /Diagnostics/ })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('radio', { name: 'Taxe foncière' }))
    const file = new File(['%PDF-1.4'], 'tf.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText(/Fichier/), { target: { files: [file] } })
    fireEvent.click(send)

    await waitFor(() => expect(screen.queryByRole('button', { name: /Envoyer/ })).not.toBeInTheDocument())
    const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!
    expect(call[0]).toBe('/api/documents?propertyId=p2&category=PROPERTY_TAX&fileName=tf.pdf')
    expect(call[1]?.body).toBe(file)
    expect((call[1]?.headers as Record<string, string>)['Content-Type']).toBe('application/pdf')
  })

  it('refuse un fichier de plus de 15 Mo avant envoi', async () => {
    mockApi(routes([]))
    renderWithProviders(<Documents />, '/documents?lease=l1')
    fireEvent.click(await screen.findByRole('button', { name: /^Ajouter$/ }))
    const big = new File(['x'], 'gros.pdf', { type: 'application/pdf' })
    Object.defineProperty(big, 'size', { value: 16 * 1024 * 1024 })
    fireEvent.change(screen.getByLabelText(/Fichier/), { target: { files: [big] } })
    expect(screen.getByRole('alert')).toHaveTextContent(/trop lourd/)
  })

  it('supprime un document après confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const fetchMock = mockApi({ ...routes([doc()]), 'DELETE /api/documents/d1': { __reply: true, status: 204 } })
    renderWithProviders(<Documents />, '/documents?lease=l1')
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer Bail signé.pdf' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/documents/d1', expect.objectContaining({ method: 'DELETE' })))
  })
})
