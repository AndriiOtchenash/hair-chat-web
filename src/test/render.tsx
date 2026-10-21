import { QueryClient } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { createMemoryRouter } from 'react-router'

import { AppProviders } from '@/app/AppProviders'
import { routes } from '@/app/routes'

/** Renders the real route tree at `path` with real providers (Auth0 is faked in setup.ts). */
export function renderApp(path = '/') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const result = render(<AppProviders queryClient={queryClient} router={router} />)
  return { ...result, router, queryClient }
}
