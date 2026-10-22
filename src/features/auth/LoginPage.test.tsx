import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import i18n from '@/i18n'

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

  it('sends signed-in users from /login to the chat', async () => {
    const { router } = renderApp('/login')

    expect(await screen.findByText('Choose a conversation or start a new one.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/chat')
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

describe('LoginPage after a failed Auth0 redirect', () => {
  function failLogin(error: string, description: string) {
    auth0.isAuthenticated = false
    auth0.error = Object.assign(new Error(description), { error, error_description: description })
  }

  it('shows a localized message by error code and clears the OAuth params from the URL', async () => {
    failLogin('access_denied', 'User did not authorize the request')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { router } = renderApp(
      '/login?error=access_denied&error_description=User%20did%20not%20authorize&state=abc&lang=x',
    )

    expect(
      await screen.findByText('Sign-in was cancelled or access was denied.'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/User did not authorize/)).not.toBeInTheDocument()
    await waitFor(() => {
      expect(router.state.location.search).toBe('?lang=x')
    })
    expect(warn).toHaveBeenCalledWith(
      'Auth0 login failed:',
      'access_denied',
      'User did not authorize the request',
    )
  })

  it('lands on /login with clean URL when Auth0 redirects to / with an error', async () => {
    failLogin('access_denied', 'denied')
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { router } = renderApp('/?error=access_denied&error_description=denied&state=abc')

    expect(
      await screen.findByText('Sign-in was cancelled or access was denied.'),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(router.state.location.search).toBe('')
  })

  it('uses a generic message for unknown codes, in the UI language', async () => {
    await i18n.changeLanguage('pl')
    failLogin('some_new_code', 'whatever')
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    renderApp('/login')

    expect(
      await screen.findByText('Nie udało się zalogować. Spróbuj ponownie.'),
    ).toBeInTheDocument()
  })

  it('shows no error on a normal visit', async () => {
    auth0.isAuthenticated = false
    renderApp('/login')

    await screen.findByRole('button', { name: 'Continue with Google' })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
