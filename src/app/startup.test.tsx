import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { WAKING_HINT_DELAY_MS, WAKING_LONGER_MS, WAKING_PHRASE_MS } from '@/components/WakingHint'
import { AUTH_LOADING_LIMIT_MS } from '@/features/auth/RequireAuth'
import { auth0 } from '@/test/auth0Mock'
import { API, consentsFixture } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render'

/** The waking phrases in en.json order; WakingHint shows them shuffled. */
const PHRASES = [
  'One moment, getting everything ready for our chat…',
  'Pulling up our past conversations…',
  'Combing through my thoughts…',
  'Just a sec, adding a little shine…',
  'Working out the tangles…',
]
const LONGER = 'This is taking a little longer than usual. Almost there…'
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

  it('explains the wait when the API has not answered for 1.5 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    server.use(http.get(`${API}/consents`, () => new Promise<never>(() => undefined)))
    renderApp('/chat')

    expect(await screen.findByText('Loading…')).toBeInTheDocument()
    const status = screen.getByRole('status')
    for (const phrase of PHRASES) expect(status).not.toHaveTextContent(phrase)

    act(() => {
      vi.advanceTimersByTime(WAKING_HINT_DELAY_MS)
    })
    expect(PHRASES.some((phrase) => status.textContent.includes(phrase))).toBe(true)
  })

  it('rotates shuffled friendly phrases, then calmly says it takes longer', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    // Fisher–Yates with random() = 0 turns [prepare, history, combing, shine, tangles]
    // into [history, combing, shine, tangles, prepare]: the order really is shuffled.
    vi.spyOn(Math, 'random').mockReturnValue(0)
    server.use(http.get(`${API}/consents`, () => new Promise<never>(() => undefined)))
    renderApp('/chat')
    const status = await screen.findByRole('status')

    act(() => {
      vi.advanceTimersByTime(WAKING_HINT_DELAY_MS)
    })
    expect(status).toHaveTextContent('Pulling up our past conversations…')

    act(() => {
      vi.advanceTimersByTime(WAKING_PHRASE_MS)
    })
    expect(status).toHaveTextContent('Combing through my thoughts…')
    act(() => {
      vi.advanceTimersByTime(WAKING_PHRASE_MS)
    })
    expect(status).toHaveTextContent('Just a sec, adding a little shine…')
    // The jokes are aria-hidden; screen readers keep hearing only the first phrase.
    expect(screen.getByText('Just a sec, adding a little shine…')).toHaveAttribute(
      'aria-hidden',
      'true',
    )
    expect(
      screen.getByText('Pulling up our past conversations…', { selector: '[aria-live="polite"]' }),
    ).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(WAKING_LONGER_MS)
    })
    expect(status).toHaveTextContent(LONGER)
    expect(status).not.toHaveTextContent('Just a sec, adding a little shine…')
    expect(screen.getByText(LONGER, { selector: '[aria-live="polite"]' })).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(WAKING_PHRASE_MS * 4)
    })
    expect(status).toHaveTextContent(LONGER)
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
    for (const phrase of PHRASES) expect(screen.queryByText(phrase)).not.toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(AUTH_LOADING_LIMIT_MS)
    })
    expect(
      screen.getByText('Sign-in is taking too long. Check your connection and try again.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})
