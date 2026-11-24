import { describe, it, expect } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { Payments } from './Payments'
import { mockApi, renderWithProviders } from '../test/utils'

const year = new Date().getFullYear()
const listPath = (y = year) => `/api/rent-payments?year=${y}`

const lyon = { id: 'p1', name: 'T3 Lyon 3e', address: '', city: 'Lyon' }
const paris = { id: 'p2', name: 'Studio Paris', address: '', city: 'Paris' }

const payment = (over: Record<string, unknown> = {}) => ({
  id: 'rp1', leaseId: 'l1', periodYear: year, periodMonth: 1,
  periodStart: `${year}-01-01T00:00:00.000Z`, periodEnd: `${year}-01-31T00:00:00.000Z`,
  rentAmount: 800, chargesAmount: 50, expectedAmount: 850, receivedAmount: 850,
  paymentDate: `${year}-01-03T00:00:00.000Z`, status: 'RECEIVED', dueDate: `${year}-01-01T00:00:00.000Z`,
  receipt: { id: 'r1', rentPaymentId: 'rp1', filePath: 'x.pdf', sentAt: null, createdAt: '' },
  lease: { id: 'l1', rentDayOfMonth: 1, property: lyon, tenant: { id: 't1', firstName: 'Jean', lastName: 'Dupont', email: '' } },
  ...over,
})

const anne = { id: 'l2', rentDayOfMonth: 5, property: paris, tenant: { id: 't2', firstName: 'Anne', lastName: 'Martin', email: '' } }

const data = [
  payment(),
  payment({ id: 'rp2', periodMonth: 2, paymentDate: `${year}-02-04T00:00:00.000Z`, dueDate: `${year}-02-01T00:00:00.000Z`, receipt: null }),
  payment({ id: 'rp3', leaseId: 'l2', lease: anne, periodMonth: 1, expectedAmount: 600, receivedAmount: 400, status: 'PARTIAL',
    paymentDate: `${year}-01-10T00:00:00.000Z`, dueDate: `${year}-01-05T00:00:00.000Z`, receipt: null }),
  payment({ id: 'rp4', leaseId: 'l2', lease: anne, periodMonth: 2, expectedAmount: 600, receivedAmount: null, status: 'LATE',
    paymentDate: null, dueDate: `${year}-02-05T00:00:00.000Z`, receipt: null }),
]

describe('page Paiements', () => {
  it("affiche les totaux de l'année, les loyers à relancer et le journal des encaissements", async () => {
    mockApi({ [listPath()]: data })
    renderWithProviders(<Payments />)

    // Encaissé : 850 + 850 + 400 ; reste dû : 200 (partiel) + 600 (retard)
    expect(await screen.findByText(/2\s100,00\s€/)).toBeInTheDocument()
    expect(screen.getByText(/^800,00\s€$/)).toBeInTheDocument()

    const relance = screen.getByRole('region', { name: 'À relancer' })
    expect(within(relance).getByText('À relancer (2)')).toBeInTheDocument()
    expect(within(relance).getByText(/reste 200,00/)).toBeInTheDocument()
    expect(within(relance).getByText(/reste 600,00/)).toBeInTheDocument()
    expect(within(relance).getAllByRole('link', { name: 'Encaisser' })[1]).toHaveAttribute('href', `/rents?year=${year}&month=2`)

    // Journal : du plus récent au plus ancien, avec la quittance ou le lien pour l'établir
    expect(screen.getByText('Encaissements (3)')).toBeInTheDocument()
    const rows = screen.getAllByText(/payé le/)
    expect(rows.map(r => r.textContent)).toEqual([
      expect.stringContaining('février'), expect.stringContaining('janvier'), expect.stringContaining('janvier'),
    ])
    expect(screen.getByRole('link', { name: /Quittance/ })).toHaveAttribute('href', '/api/rent-payments/rp1/receipt')
    expect(screen.getByRole('link', { name: 'Établir la quittance' })).toHaveAttribute('href', `/rents?year=${year}&month=2`)
    expect(screen.getByText('Partiel')).toBeInTheDocument()
  })

  it('filtre par bien et change d’année', async () => {
    const fetchMock = mockApi({ [listPath()]: data, [listPath(year - 1)]: [] })
    renderWithProviders(<Payments />)

    fireEvent.change(await screen.findByLabelText('Bien'), { target: { value: 'p2' } })
    expect(screen.getByText('Encaissements (1)')).toBeInTheDocument()
    expect(screen.queryByText(/Jean Dupont/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Année précédente' }))
    expect(await screen.findByText(`Aucune échéance en ${year - 1}`)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(`/api/rent-payments?year=${year - 1}`, expect.anything())
  })
})
