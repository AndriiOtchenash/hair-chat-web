import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { toast } from 'sonner'
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest'

import i18n from '@/i18n'

import { resetAuth0, useAuth0Mock } from './auth0Mock'
import { defaultHandlers } from './msw/handlers'
import { server } from './msw/server'

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: useAuth0Mock,
  Auth0Provider: ({ children }: { children: unknown }) => children,
}))

// jsdom has no layout: scrolling is a no-op.
Element.prototype.scrollIntoView = () => undefined

// Any request without a handler fails the test: no real network in tests.
beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' })
})
beforeEach(async () => {
  server.resetHandlers(...defaultHandlers())
  resetAuth0()
  localStorage.clear()
  await i18n.changeLanguage('en')
})
afterEach(() => {
  cleanup()
  // sonner keeps toasts in a module-level store and replays active ones to the next Toaster.
  toast.dismiss()
})
afterAll(() => {
  server.close()
})
