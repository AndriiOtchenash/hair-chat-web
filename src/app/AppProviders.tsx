import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { RouterProvider, type createBrowserRouter } from 'react-router'

import { Toaster } from '@/components/ui/sonner'
import { ApiClientProvider } from '@/shared/api/ApiClientProvider'

type Router = ReturnType<typeof createBrowserRouter>

/** Query cache, API client and router; shared by App and the test renderer. Auth0 wraps it. */
export function AppProviders({
  queryClient,
  router,
}: {
  queryClient: QueryClient
  router: Router
}) {
  const navigate = useCallback((to: string) => void router.navigate(to), [router])
  return (
    <QueryClientProvider client={queryClient}>
      <ApiClientProvider navigate={navigate}>
        <RouterProvider router={router} />
        <Toaster position="top-center" />
      </ApiClientProvider>
    </QueryClientProvider>
  )
}
