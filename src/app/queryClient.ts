import { QueryClient } from '@tanstack/react-query'

import { ApiError } from '@/shared/api/errors'

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Retry only transient failures; 4xx answers will not change on retry.
        retry: (failureCount, error) =>
          failureCount < 2 &&
          !(error instanceof ApiError && error.status >= 400 && error.status < 500),
        refetchOnWindowFocus: false,
      },
    },
  })
}
