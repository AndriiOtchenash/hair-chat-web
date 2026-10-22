import { useAuth0 } from '@auth0/auth0-react'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import { useApiClient } from '@/shared/api/apiClientContext'

/**
 * Ends the session for good (after DELETE /me): no more API calls (the backend would recreate the
 * user from a still-valid token), cached data dropped, then Auth0 logout back to `returnPath`.
 * `returnPath` must be in the Auth0 application's Allowed Logout URLs.
 */
export function useEndSession() {
  const api = useApiClient()
  const queryClient = useQueryClient()
  const { logout } = useAuth0()
  return useCallback(
    async (returnPath: string) => {
      api.endSession()
      await queryClient.cancelQueries()
      queryClient.clear()
      await logout({ logoutParams: { returnTo: `${window.location.origin}${returnPath}` } })
    },
    [api, queryClient, logout],
  )
}
