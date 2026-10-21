import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { auth0 } from '@/test/auth0Mock'
import { renderApp } from '@/test/render'

describe('LoginPage', () => {
  it('redirects anonymous users to /login and starts Google login', async () => {
    auth0.isAuthenticated = false
    const { router } = renderApp('/')

    const button = await screen.findByRole('button', { name: 'Continue with Google' })
    expect(router.state.location.pathname).toBe('/login')
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument()

    await userEvent.click(button)
    expect(auth0.loginWithRedirect).toHaveBeenCalledWith({
      authorizationParams: { connection: 'google-oauth2' },
    })
  })

  it('sends signed-in users from /login to the home page', async () => {
    const { router } = renderApp('/login')

    expect(await screen.findByText('Your account')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('shows a spinner while Auth0 restores the session', () => {
    auth0.isLoading = true
    auth0.isAuthenticated = false
    renderApp('/')

    expect(screen.getByRole('status')).toHaveTextContent('Loading')
  })

  it('signs out from the header', async () => {
    renderApp('/')

    await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }))
    expect(auth0.logout).toHaveBeenCalledWith({
      logoutParams: { returnTo: window.location.origin },
    })
  })
})
