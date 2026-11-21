import { describe, it, expect } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import { Notifications } from './Notifications'
import { NotificationBell } from '../components/NotificationBell'
import { mockApi, renderWithProviders } from '../test/utils'

const notif = (over: Record<string, unknown> = {}) => ({
  id: 'n1', kind: 'REVISION_UPCOMING', leaseId: 'l1', dueDate: '2026-01-01T00:00:00.000Z',
  title: 'Révision du loyer à préparer : Jean Dupont', body: 'Ligne 1\nVotre quote-part (50 %)', link: '/leases/l1',
  readAt: null, createdAt: '2025-11-15T08:00:00.000Z', ...over,
})

describe('notifications', () => {
  it('la cloche affiche le nombre de non lues', async () => {
    mockApi({ '/api/notifications': [notif(), notif({ id: 'n2', readAt: '2025-11-16T00:00:00.000Z' })] })
    renderWithProviders(<NotificationBell />)
    expect(await screen.findByLabelText('Notifications (1 non lues)')).toHaveAttribute('href', '/notifications')
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('liste les notifications, ouvre le bail et marque comme lu', async () => {
    const fetchMock = mockApi({ '/api/notifications': [notif()], 'POST /api/notifications/n1/read': null, 'POST /api/notifications/read-all': null })
    renderWithProviders(<Routes><Route path="/notifications" element={<Notifications />} /></Routes>, '/notifications')
    expect(await screen.findByText('Révision du loyer à préparer : Jean Dupont')).toBeInTheDocument()
    expect(screen.getByText(/Votre quote-part \(50 %\)/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ouvrir le bail' })).toHaveAttribute('href', '/leases/l1')
    fireEvent.click(screen.getByLabelText('Marquer « Révision du loyer à préparer : Jean Dupont » comme lue'))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/notifications/n1/read', expect.objectContaining({ method: 'POST' })))
    fireEvent.click(screen.getByRole('button', { name: /Tout marquer comme lu/ }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/notifications/read-all', expect.objectContaining({ method: 'POST' })))
  })

  it('lien absolu (APP_URL) : on garde le chemin', async () => {
    mockApi({ '/api/notifications': [notif({ link: 'https://gestion.exemple.fr/leases/l1' })] })
    renderWithProviders(<Routes><Route path="/notifications" element={<Notifications />} /></Routes>, '/notifications')
    expect(await screen.findByRole('link', { name: 'Ouvrir le bail' })).toHaveAttribute('href', '/leases/l1')
  })

  it('prochains rappels : date d’envoi, état, vérification à la demande', async () => {
    const up = (over: Record<string, unknown>) => ({
      leaseId: 'l1', tenantName: 'Jean Dupont', propertyName: 'Studio', anniversary: '2027-01-21T00:00:00.000Z',
      remindOn: '2026-11-22T00:00:00.000Z', daysLeft: 61, status: 'planned', sentAt: null, ...over,
    })
    const fetchMock = mockApi({
      '/api/notifications': [],
      '/api/notifications/upcoming': [up({}), up({ leaseId: 'l2', tenantName: 'Paul Durand', status: 'sent', sentAt: '2026-11-01T08:00:00.000Z', daysLeft: 20 })],
      'POST /api/notifications/check': { created: 0, upcoming: [] },
    })
    renderWithProviders(<Routes><Route path="/notifications" element={<Notifications />} /></Routes>, '/notifications')
    expect(await screen.findByText(/rappel à partir du 22 novembre 2026/)).toBeInTheDocument()
    expect(screen.getByText(/anniversaire le 21 janvier 2027 \(dans 61 j\)/)).toBeInTheDocument()
    expect(screen.getByText('rappel envoyé le 01 novembre 2026')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Vérifier maintenant/ }))
    expect(await screen.findByText('Aucun rappel à envoyer aujourd’hui')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/notifications/check', expect.objectContaining({ method: 'POST' }))
  })
})
