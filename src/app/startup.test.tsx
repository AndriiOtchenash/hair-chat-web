import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { WAKING_HINT_DELAY_MS } from '@/components/WakingHint'
import { AUTH_LOADING_LIMIT_MS } from '@/features/auth/RequireAuth'
import { auth0 } from '@/test/auth0Mock'
import { API, consentsFixture } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render'

const WAKING = 'The service is waking up, this will take a few seconds…'
const CHAT_HOME = 'Choose a conversation or start a new one.'
const UNAVAILABLE = 'The service is not available right now. Please try again in a minute.'

/** GET /consents: answers with `statuses` in turn (504 = bare proxy page), then the fixture. */
function consentsAnswering(...statuses: number[]) {
  let calls = 0
  server.use(
    http.get(`${API}/consents`, () => {
      const status = statuses[calls]
      calls += 1
      if (status === undefined) return HttpResponse.json(consentsFixture())
      return new HttpResponse('<html>504 Gateway Time-out</html>', { status })
    }),
  )
  return () => calls
}

afterEach(() => {
  vi.useRealTimers()
})

describe('startup while the API wakes up', () => {
  it('retries a 504 and lets the user into the chat', async () => {
    const calls = consentsAnswering(504)
    renderApp('/chat', { retries: true })

    expect(await screen.findByText(CHAT_HOME)).toBeInTheDocument()
    expect(calls()).toBe(2)
  })

  it('stops after three 504s with a clear error and a retry button', async () => {
    const calls = consentsAnswering(504, 504, 504)
    const user = userEvent.setup()
    renderApp('/chat', { retries: true })

    expect(await screen.findByText(UNAVAILABLE)).toBeInTheDocument()
    expect(calls()).toBe(3)
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText(CHAT_HOME)).toBeInTheDocument()
    expect(calls()).toBe(4)
  })

  it('does not retry a 4xx', async () => {
    let calls = 0
    server.use(
      http.get(`${API}/consents`, () => {
        calls += 1
        return HttpResponse.json({ code: 'forbidden', message: 'No' }, { status: 403 })
      }),
    )
    renderApp('/chat', { retries: true })

    expect(await screen.findByText('You do not have access to this.')).toBeInTheDocument()
    expect(calls).toBe(1)
  })

  it('explains the wait when the API has not answered for 3 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    server.use(http.get(`${API}/consents`, () => new Promise<never>(() => undefined)))
    renderApp('/chat')

    expect(await screen.findByText('Loading…')).toBeInTheDocument()
    expect(screen.queryByText(WAKING)).not.toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(WAKING_HINT_DELAY_MS)
    })
    expect(screen.getByRole('status')).toHaveTextContent(WAKING)
  })

  it('offers a reload when Auth0 keeps loading', () => {
    vi.useFakeTimers()
    auth0.isLoading = true
    renderApp('/chat')

    expect(screen.getByText('Loading…')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(WAKING_HINT_DELAY_MS)
    })
    // Not our API: no "waking up" while Auth0 restores the session.
    expect(screen.queryByText(WAKING)).not.toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(AUTH_LOADING_LIMIT_MS)
    })
    expect(
      screen.getByText('Sign-in is taking too long. Check your connection and try again.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})
