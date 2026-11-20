import { describe, it, expect } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { BottomNav } from './BottomNav'
import { renderWithProviders } from '../../test/utils'

describe('BottomNav', () => {
  it('affiche 4 entrées principales et un menu « Plus » avec Locataires et Compte', () => {
    renderWithProviders(<BottomNav />)
    for (const label of ['Accueil', 'Biens', 'Locations', 'Loyers', 'Plus']) expect(screen.getByText(label)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Plus'))
    const menu = screen.getByRole('dialog', { name: 'Menu' })
    expect(menu).toHaveTextContent('Locataires')
    expect(menu).toHaveTextContent('Compte / Profil')
  })
})
