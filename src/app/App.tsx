import { useState } from 'react'
import { createBrowserRouter } from 'react-router'

import { AppProviders } from './AppProviders'
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
      <AppProviders queryClient={queryClient} router={router} />
    </AuthProvider>
  )
}
