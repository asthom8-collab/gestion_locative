import { describe, it, expect } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { OwnersModal, totalPercent } from './OwnersModal'
import { mockApi, renderWithProviders, property, reply } from '../test/utils'
import type { Property } from '../types'

const me = { id: 'u1', email: 'admin@local.dev', firstName: 'Thomas', lastName: 'Admin', role: 'ADMIN', address: null, zipCode: null, city: null, mustChangePassword: false, hasSignature: false }
const users = [
  { id: 'u1', firstName: 'Thomas', lastName: 'Admin', email: 'admin@local.dev' },
  { id: 'u2', firstName: 'Claire', lastName: 'Copro', email: 'claire@local.dev' },
]
const prop = property({ ownerships: [{ id: 'o1', userId: 'u1', share: 1, user: users[0] }] }) as unknown as Property

describe('fenêtre des propriétaires', () => {
  it('ajoute une copropriétaire, n’autorise l’enregistrement qu’à 100 %, et envoie les quotes-parts', async () => {
    const fetchMock = mockApi({ '/api/me': me, '/api/users': users, 'PUT /api/properties/p1/owners': [] })
    renderWithProviders(<OwnersModal property={prop} onClose={() => {}} />)
    fireEvent.change(await screen.findByLabelText('Ajouter un propriétaire'), { target: { value: 'u2' } })
    const save = screen.getByRole('button', { name: /Enregistrer/ })
    expect(save).toBeDisabled() // 100 % + 0 %
    fireEvent.change(screen.getByLabelText('Quote-part de Thomas Admin'), { target: { value: '70' } })
    fireEvent.change(screen.getByLabelText('Quote-part de Claire Copro'), { target: { value: '20' } })
    expect(screen.getByText('90 %')).toBeInTheDocument()
    expect(save).toBeDisabled()
    fireEvent.click(screen.getByText('Parts égales'))
    expect(screen.getByText('100 %')).toBeInTheDocument()
    fireEvent.click(save)
    await waitFor(() => expect(fetchMock.mock.calls.some(([, i]) => i?.method === 'PUT')).toBe(true))
    const call = fetchMock.mock.calls.find(([, i]) => i?.method === 'PUT')!
    expect(JSON.parse(call[1]!.body as string)).toEqual({ owners: [
      { userId: 'u1', share: 0.5, startDate: null, endDate: null }, { userId: 'u2', share: 0.5, startDate: null, endDate: null },
    ] })
  })

  it('changement de propriétaire : dates de détention, total calculé à aujourd’hui', async () => {
    const fetchMock = mockApi({ '/api/me': me, '/api/users': users, 'PUT /api/properties/p1/owners': reply(400, { error: 'La somme des quotes-parts doit faire 100 % au 01/07/2020 (actuellement 0 %)' }) })
    renderWithProviders(<OwnersModal property={prop} onClose={() => {}} />)
    fireEvent.change(await screen.findByLabelText('Ajouter un propriétaire'), { target: { value: 'u2' } })
    fireEvent.change(screen.getByLabelText('Quote-part de Claire Copro'), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText('Fin de détention de Thomas Admin'), { target: { value: '2020-06-30' } })
    fireEvent.change(screen.getByLabelText('Début de détention de Claire Copro'), { target: { value: '2020-07-02' } })
    expect(screen.getByText('ancien propriétaire')).toBeInTheDocument()
    expect(screen.getByText(/Total aujourd’hui/)).toHaveTextContent('100 %')
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('au 01/07/2020')
    const call = fetchMock.mock.calls.find(([, i]) => i?.method === 'PUT')!
    expect(JSON.parse(call[1]!.body as string).owners).toEqual([
      { userId: 'u1', share: 1, startDate: null, endDate: '2020-06-30' }, { userId: 'u2', share: 1, startDate: '2020-07-02', endDate: null },
    ])
  })

  it('on ne peut pas se retirer soi-même', async () => {
    mockApi({ '/api/me': me, '/api/users': users })
    renderWithProviders(<OwnersModal property={prop} onClose={() => {}} />)
    await waitFor(() => expect(screen.getByLabelText('Retirer Thomas Admin')).toBeDisabled())
  })

  it('totalPercent arrondit au centième (33,33 + 33,33 + 33,34 = 100)', () => {
    expect(totalPercent([{ userId: 'a', percent: 33.33 }, { userId: 'b', percent: 33.33 }, { userId: 'c', percent: 33.34 }])).toBe(100)
  })
})
