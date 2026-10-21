import { useAuth0 } from '@auth0/auth0-react'
import { useMemo, type ReactNode } from 'react'

import { config } from '@/shared/config/env'

import { ApiClientContext } from './apiClientContext'
import { createApiClient } from './client'

/** Wires the fetch wrapper to Auth0: Bearer token from the SPA session, 401 -> logout. */
export function ApiClientProvider({ children }: { children: ReactNode }) {
  const { getAccessTokenSilently, logout } = useAuth0()
  const client = useMemo(
    () =>
      createApiClient({
        baseUrl: config.apiBaseUrl,
        getToken: async () => {
          const token = await getAccessTokenSilently()
          if (!token) throw new Error('No access token')
          return token
        },
        onUnauthorized: () => {
          void logout({ logoutParams: { returnTo: window.location.origin } })
        },
      }),
    [getAccessTokenSilently, logout],
  )
  return <ApiClientContext.Provider value={client}>{children}</ApiClientContext.Provider>
}
