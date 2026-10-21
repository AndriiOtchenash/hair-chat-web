import { Auth0Provider, type AppState } from '@auth0/auth0-react'
import type { ReactNode } from 'react'

import { config } from '@/shared/config/env'

/**
 * Authorization Code + PKCE (auth0-spa-js default). Tokens stay in memory (not localStorage, so
 * XSS cannot read them after a reload). Refresh tokens (rotation enabled in Auth0) renew access
 * tokens; after a reload the session is restored via Auth0's silent-auth iframe (fallback).
 */
export function AuthProvider({
  children,
  onRedirectCallback,
}: {
  children: ReactNode
  onRedirectCallback?: (appState?: AppState) => void
}) {
  return (
    <Auth0Provider
      domain={config.auth0.domain}
      clientId={config.auth0.clientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: config.auth0.audience,
      }}
      useRefreshTokens
      useRefreshTokensFallback
      cacheLocation="memory"
      onRedirectCallback={onRedirectCallback}
    >
      {children}
    </Auth0Provider>
  )
}
