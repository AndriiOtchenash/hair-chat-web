import { QueryClient } from '@tanstack/react-query'

import { retryDelayMs, retryTransient } from '@/shared/api/retry'

export function createQueryClient({ retryBaseDelayMs = 1000 } = {}) {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Retry only transient failures (gateway 502/503/504, network, timeout), e.g. while the
        // API wakes up; 4xx answers will not change on retry. Mutations are never retried.
        retry: retryTransient,
        retryDelay: (attempt) => retryDelayMs(attempt, retryBaseDelayMs),
        refetchOnWindowFocus: false,
      },
    },
  })
}
