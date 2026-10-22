import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { auth0 } from '@/test/auth0Mock'
import { renderApp } from '@/test/render'

// jsdom applies no CSS: both the desktop row (hidden below sm) and the burger (hidden from sm)
// are in the DOM; these tests check the burger's content and that it is the narrow-screen variant.
describe('Header mobile menu', () => {
  it('hides the desktop row below sm and shows the burger only there', async () => {
    renderApp('/chat')

    const burger = await screen.findByRole('button', { name: 'Menu' })
    expect(burger.parentElement).toHaveClass('sm:hidden')
    const signOut = screen.getByRole('button', { name: 'Sign out' })
    expect(signOut.closest('.hidden')).toHaveClass('sm:flex')
  })

  it('contains navigation, language and sign-out', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/chat')

    await user.click(await screen.findByRole('button', { name: 'Menu' }))
    const menu = await screen.findByRole('menu')
    expect(within(menu).getByRole('menuitem', { name: 'Chat' })).toHaveAttribute('href', '/chat')
    expect(within(menu).getAllByRole('menuitemradio')).toHaveLength(4)
    expect(within(menu).getByRole('menuitemradio', { name: 'English' })).toBeChecked()
    expect(within(menu).getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument()

    await user.click(within(menu).getByRole('menuitem', { name: 'Settings' }))
    expect(router.state.location.pathname).toBe('/settings')
  })

  it('switches the language and signs out from the menu', async () => {
    const user = userEvent.setup()
    renderApp('/chat')

    await user.click(await screen.findByRole('button', { name: 'Menu' }))
    await user.click(await screen.findByRole('menuitemradio', { name: 'Українська' }))
    expect(await screen.findByText('Оберіть бесіду або почніть нову.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Меню' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Вийти' }))
    expect(auth0.logout).toHaveBeenCalledWith({
      logoutParams: { returnTo: window.location.origin },
    })
  })

  it('shows only the language switcher before sign-in', async () => {
    auth0.isAuthenticated = false
    renderApp('/login')

    expect(await screen.findByRole('button', { name: 'Language' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Menu' })).not.toBeInTheDocument()
  })
})
