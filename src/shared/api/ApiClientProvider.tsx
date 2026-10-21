import { useAuth0 } from '@auth0/auth0-react'
import { useQueryClient } from '@tanstack/react-query'
import { useMemo, type ReactNode } from 'react'

import { config } from '@/shared/config/env'

import { ApiClientContext } from './apiClientContext'
import { createApiClient } from './client'
import { queryKeys } from './queryKeys'

/**
 * Wires the fetch wrapper to the app: Bearer token from Auth0, 401 -> logout,
 * 403 consent_required -> refetch consents and go to /consents. Must be inside QueryClientProvider.
 */
export function ApiClientProvider({
  children,
  navigate,
}: {
  children: ReactNode
  /** Router navigation (router.navigate); the provider sits outside <RouterProvider>. */
  navigate: (to: string) => void
}) {
  const { getAccessTokenSilently, logout } = useAuth0()
  const queryClient = useQueryClient()
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
        onConsentRequired: () => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.consents })
          navigate('/consents')
        },
      }),
    [getAccessTokenSilently, logout, queryClient, navigate],
  )
  return <ApiClientContext.Provider value={client}>{children}</ApiClientContext.Provider>
}
