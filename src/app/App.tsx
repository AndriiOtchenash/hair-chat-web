import { QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { RouterProvider, createBrowserRouter } from 'react-router'

import { ApiClientProvider } from '@/shared/api/ApiClientProvider'

import { AuthProvider } from './AuthProvider'
import { createQueryClient } from './queryClient'
import { routes } from './routes'

export function App() {
  const [queryClient] = useState(createQueryClient)
  const [router] = useState(() => createBrowserRouter(routes))

  return (
    <AuthProvider
      onRedirectCallback={(appState) =>
        void router.navigate(appState?.returnTo ?? '/', { replace: true })
      }
    >
      <ApiClientProvider>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </ApiClientProvider>
    </AuthProvider>
  )
}
