import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { auth0 } from '@/test/auth0Mock'
import { API } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render'

describe('MePage', () => {
  it('shows id, role and locale from GET /me', async () => {
    renderApp('/')

    expect(await screen.findByText('01929b2e-7c4a-7d3e-9f00-123456789abc')).toBeInTheDocument()
    expect(screen.getByText('User')).toBeInTheDocument()
    expect(screen.getByText('Українська')).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent('You are chatting with an AI assistant')
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  })

  it('shows an API error as localized text, not the raw server message', async () => {
    server.use(
      http.get(`${API}/me`, () =>
        HttpResponse.json({ code: 'auth_unavailable', message: 'JWKS down' }, { status: 503 }),
      ),
    )
    renderApp('/')

    expect(
      await screen.findByText(
        'Sign-in service is temporarily unavailable. Please try again later.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText('JWKS down')).not.toBeInTheDocument()
  })

  it('falls back to a generic message for unknown codes', async () => {
    server.use(
      http.get(`${API}/me`, () =>
        HttpResponse.json({ code: 'teapot', message: 'x' }, { status: 418 }),
      ),
    )
    renderApp('/')

    expect(await screen.findByText('Unexpected error. Please try again.')).toBeInTheDocument()
  })

  it('logs out when the API answers 401', async () => {
    server.use(
      http.get(`${API}/me`, () =>
        HttpResponse.json({ code: 'invalid_token', message: 'expired' }, { status: 401 }),
      ),
    )
    renderApp('/')

    expect(
      await screen.findByText('Your session has ended. Please sign in again.'),
    ).toBeInTheDocument()
    expect(auth0.logout).toHaveBeenCalledWith({
      logoutParams: { returnTo: window.location.origin },
    })
  })
})
