import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { CONSENT_VERSION } from '@/consents'
import i18n from '@/i18n'
import type { GrantConsentsRequest } from '@/shared/api/types'
import { API, consentsFixture, consentsHandlers } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render'

const AGE = 'I confirm that I am at least 18 years old.'
const HEALTH = /I agree to the processing of information about my hair and scalp/
const AI = /I understand that an AI answers me/

function recordPosts() {
  const bodies: GrantConsentsRequest[] = []
  server.events.on('request:start', ({ request }) => {
    if (request.method === 'POST' && request.url.endsWith('/consents')) {
      void request
        .clone()
        .json()
        .then((body: unknown) => bodies.push(body as GrantConsentsRequest))
    }
  })
  return bodies
}

describe('routing by consents', () => {
  it('sends a user without consents from / to /consents', async () => {
    server.use(...consentsHandlers(consentsFixture({ granted: [] })))
    const { router } = renderApp('/')

    expect(await screen.findByRole('heading', { name: 'Before we start' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/consents')
  })

  it('lets a user with all consents into the chat', async () => {
    const { router } = renderApp('/')

    expect(await screen.findByText('Choose a conversation or start a new one.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/chat')
    expect(screen.getByRole('note')).toHaveTextContent('You are chatting with an AI assistant')
  })

  it('sends the user to /consents when any API call answers 403 consent_required', async () => {
    server.use(
      http.get(`${API}/me`, () =>
        HttpResponse.json(
          { code: 'consent_required', message: 'Missing consents: ai_processing' },
          { status: 403 },
        ),
      ),
    )
    const { router } = renderApp('/settings')

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/consents')
    })
  })
})

describe('ConsentsPage', () => {
  it('enables Continue only when all three are checked, then POSTs them and opens the chat', async () => {
    server.use(...consentsHandlers(consentsFixture({ granted: [] })))
    const posts = recordPosts()
    const user = userEvent.setup()
    const { router } = renderApp('/consents')

    const continueButton = await screen.findByRole('button', { name: 'Continue' })
    expect(continueButton).toBeDisabled()

    await user.click(screen.getByRole('checkbox', { name: AGE }))
    await user.click(screen.getByRole('checkbox', { name: HEALTH }))
    expect(continueButton).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: AI }))
    expect(continueButton).toBeEnabled()

    await user.click(continueButton)

    expect(await screen.findByText('Choose a conversation or start a new one.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/chat')
    expect(posts).toEqual([
      { types: ['age_18', 'health_data', 'ai_processing'], version: CONSENT_VERSION },
    ])
  })

  it('asks only for the missing consent when the others are granted', async () => {
    server.use(...consentsHandlers(consentsFixture({ granted: ['age_18', 'ai_processing'] })))
    const posts = recordPosts()
    const user = userEvent.setup()
    renderApp('/consents')

    const age = await screen.findByRole('checkbox', { name: AGE })
    expect(age).toBeChecked()
    expect(age).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()

    await user.click(screen.getByRole('checkbox', { name: HEALTH }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await screen.findByText('Choose a conversation or start a new one.')
    expect(posts).toEqual([{ types: ['health_data'], version: CONSENT_VERSION }])
  })

  it('says the terms were updated when older-version consents exist', async () => {
    server.use(
      ...consentsHandlers(
        consentsFixture({ granted: [], older: ['age_18', 'health_data', 'ai_processing'] }),
      ),
    )
    renderApp('/consents')

    expect(
      await screen.findByRole('heading', { name: 'The terms have been updated' }),
    ).toBeInTheDocument()
  })

  it('shows an error and no form when the backend requires another text version', async () => {
    server.use(...consentsHandlers(consentsFixture({ granted: [], requiredVersion: '2027-01-v2' })))
    const posts = recordPosts()
    const { router } = renderApp('/chat')

    expect(await screen.findByText('Consent texts are out of date')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/consents')
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument()
    expect(posts).toEqual([])
  })

  it('shows a POST error as localized text', async () => {
    // First matching handler wins: the failing POST goes before the stateful fake.
    server.use(
      http.post(`${API}/consents`, () =>
        HttpResponse.json(
          { code: 'consent_version_mismatch', message: 'current version is X' },
          { status: 400 },
        ),
      ),
      ...consentsHandlers(consentsFixture({ granted: ['age_18', 'health_data'] })),
    )
    const user = userEvent.setup()
    renderApp('/consents')

    await user.click(await screen.findByRole('checkbox', { name: AI }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(
      await screen.findByText(
        'The consent texts have changed. Reload the page to see the current version.',
      ),
    ).toBeInTheDocument()
  })

  it('opens the full text in a dialog', async () => {
    server.use(...consentsHandlers(consentsFixture({ granted: [] })))
    const user = userEvent.setup()
    renderApp('/consents')

    const [, healthMore, ...rest] = await screen.findAllByRole('button', { name: 'Read more' })
    expect(rest).toHaveLength(1)
    if (!healthMore) throw new Error('no "Read more" for health_data')
    await user.click(healthMore)

    const dialog = await screen.findByRole('dialog', { name: 'Hair and scalp data' })
    expect(within(dialog).getByText(/Article 9 GDPR/)).toBeInTheDocument()
    expect(dialog).not.toHaveTextContent('consent:')
  })

  it('shows the texts in the UI language', async () => {
    server.use(...consentsHandlers(consentsFixture({ granted: [] })))
    await i18n.changeLanguage('uk')
    renderApp('/consents')

    expect(
      await screen.findByRole('checkbox', { name: 'Я підтверджую, що мені 18 років або більше.' }),
    ).toBeInTheDocument()
  })
})
