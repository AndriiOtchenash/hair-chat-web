import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import i18n, { LANGUAGE_STORAGE_KEY } from '@/i18n'
import type { UpdateMeRequest } from '@/shared/api/types'
import { auth0 } from '@/test/auth0Mock'
import { API, consentsFixture, consentsHandlers, meFixture } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render'

function recordPatches() {
  const bodies: UpdateMeRequest[] = []
  server.events.on('request:start', ({ request }) => {
    if (request.method === 'PATCH') {
      void request
        .clone()
        .json()
        .then((body: unknown) => bodies.push(body as UpdateMeRequest))
    }
  })
  return bodies
}

describe('profile language', () => {
  it('saves the language picked in the header with PATCH /me', async () => {
    const patches = recordPatches()
    const user = userEvent.setup()
    renderApp('/chat')

    await user.click(await screen.findByRole('button', { name: 'Language' }))
    await user.click(await screen.findByRole('menuitemradio', { name: 'Polski' }))

    expect(await screen.findByText('Wybierz rozmowę albo zacznij nową.')).toBeInTheDocument()
    await waitFor(() => {
      expect(patches).toEqual([{ locale: 'pl' }])
    })
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('pl')
  })

  it('keeps the new language and shows a toast when PATCH /me fails', async () => {
    server.use(
      http.patch(`${API}/me`, () =>
        HttpResponse.json({ code: 'internal_error', message: 'boom' }, { status: 500 }),
      ),
    )
    const user = userEvent.setup()
    renderApp('/settings')

    await user.click(await screen.findByRole('radio', { name: 'Українська' }))

    expect(
      await screen.findByText(
        'Не вдалося зберегти мову в профілі. У цьому браузері вона все одно діє.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Українська' })).toBeChecked()
    expect(screen.getByRole('heading', { name: 'Налаштування' })).toBeInTheDocument()
  })

  it('does not call the API when switching language before sign-in', async () => {
    auth0.isAuthenticated = false
    const patches = recordPatches()
    const user = userEvent.setup()
    renderApp('/login')

    await user.click(await screen.findByRole('button', { name: 'Language' }))
    await user.click(await screen.findByRole('menuitemradio', { name: 'Русский' }))

    expect(await screen.findByRole('button', { name: 'Войти через Google' })).toBeInTheDocument()
    expect(patches).toEqual([])
  })

  it('on first sign-in saves the UI language to the profile', async () => {
    await i18n.changeLanguage('pl')
    server.use(...consentsHandlers(consentsFixture({ granted: [] })))
    const patches = recordPatches()
    renderApp('/')

    await screen.findByRole('heading', { name: 'Zanim zaczniemy' })
    await waitFor(() => {
      expect(patches).toEqual([{ locale: 'pl' }])
    })
    expect(i18n.resolvedLanguage).toBe('pl')
  })

  it('for a returning user without an explicit choice applies the profile locale', async () => {
    server.use(http.get(`${API}/me`, () => HttpResponse.json({ ...meFixture, locale: 'uk' })))
    const patches = recordPatches()
    renderApp('/chat')

    expect(await screen.findByText('Оберіть бесіду або почніть нову.')).toBeInTheDocument()
    expect(patches).toEqual([])
  })

  it('keeps an explicit choice made in this browser', async () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en')
    server.use(http.get(`${API}/me`, () => HttpResponse.json({ ...meFixture, locale: 'uk' })))
    const patches = recordPatches()
    renderApp('/settings')

    expect(await screen.findByText('01929b2e-7c4a-7d3e-9f00-123456789abc')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    expect(patches).toEqual([])
  })
})
