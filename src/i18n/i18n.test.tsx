import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { auth0 } from '@/test/auth0Mock'
import { renderApp } from '@/test/render'

import i18n, { LANGUAGE_STORAGE_KEY, SUPPORTED_LANGUAGES, resources } from '.'

function keysOf(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix]
  return Object.entries(value).flatMap(([k, v]) => keysOf(v, prefix ? `${prefix}.${k}` : k))
}

describe('i18n', () => {
  it.each(SUPPORTED_LANGUAGES)('locale %s has exactly the keys of en.json', (lng) => {
    expect(keysOf(resources[lng].translation).sort()).toEqual(
      keysOf(resources.en.translation).sort(),
    )
  })

  it('maps a regional browser language to a supported one', async () => {
    await i18n.changeLanguage('pl-PL')
    expect(i18n.resolvedLanguage).toBe('pl')
  })

  it('switches the UI language from the header and remembers the choice', async () => {
    auth0.isAuthenticated = false
    const user = userEvent.setup()
    renderApp('/login')

    await user.click(await screen.findByRole('button', { name: 'Language' }))
    await user.click(await screen.findByRole('menuitemradio', { name: 'Українська' }))

    expect(await screen.findByRole('button', { name: 'Увійти через Google' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Мова' })).toHaveTextContent('Українська')
    expect(document.documentElement.lang).toBe('uk')
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('uk')
  })
})
