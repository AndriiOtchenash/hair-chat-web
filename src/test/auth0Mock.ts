import type { useAuth0 } from '@auth0/auth0-react'
import { vi } from 'vitest'

type Auth0State = ReturnType<typeof useAuth0>

/** Mutable fake of useAuth0(); reset before every test in setup.ts. Tests never talk to Auth0. */
export const auth0 = {
  isLoading: false,
  isAuthenticated: true,
  error: undefined as Error | undefined,
  user: { sub: 'google-oauth2|123', name: 'Test User' },
  getAccessTokenSilently: vi.fn(() => Promise.resolve('test-token')),
  loginWithRedirect: vi.fn(() => Promise.resolve()),
  logout: vi.fn(() => Promise.resolve()),
}

export function resetAuth0(): void {
  auth0.isLoading = false
  auth0.isAuthenticated = true
  auth0.error = undefined
  auth0.getAccessTokenSilently = vi.fn(() => Promise.resolve('test-token'))
  auth0.loginWithRedirect = vi.fn(() => Promise.resolve())
  auth0.logout = vi.fn(() => Promise.resolve())
}

export const useAuth0Mock = () => auth0 as unknown as Auth0State
