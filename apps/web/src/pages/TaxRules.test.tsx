import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import { TaxRules } from './TaxRules'
import { renderWithProviders } from '../test/utils'

describe('page Règles fiscales des travaux', () => {
  it('présente les natures, le tableau par régime, les cas particuliers et les sources', () => {
    renderWithProviders(<TaxRules />)
    // Les définitions sont celles de l'aide du formulaire
    expect(screen.getByText(/isolation, chauffage central, double vitrage/)).toBeInTheDocument()
    const commercial = screen.getByText('Location nue : local commercial').closest('tr')!
    expect(within(commercial).getByText('Non déductible*')).toBeInTheDocument()
    const lmnp = screen.getByText('LMNP au réel').closest('tr')!
    expect(within(lmnp).getAllByText('À amortir')).toHaveLength(2)
    expect(screen.getByText(/main-d’œuvre du propriétaire n’est jamais déductible/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /BOI-RFPI-BASE-20-30-30/ })).toHaveAttribute('href', 'https://bofip.impots.gouv.fr/doctrine/BOI-RFPI-BASE-20-30-30')
  })
})
