import { QueryClient } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { createMemoryRouter } from 'react-router'

import { AppProviders } from '@/app/AppProviders'
import { createQueryClient } from '@/app/queryClient'
import { routes } from '@/app/routes'

/**
 * Renders the real route tree at `path` with real providers (Auth0 is faked in setup.ts).
 * Queries do not retry unless `retries`: then the app's retry policy runs with 1 ms pauses.
 */
export function renderApp(path = '/', { retries = false } = {}) {
  const queryClient = retries
    ? createQueryClient({ retryBaseDelayMs: 1 })
    : new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const result = render(<AppProviders queryClient={queryClient} router={router} />)
  return { ...result, router, queryClient }
}
