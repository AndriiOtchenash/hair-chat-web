import { useQuery } from '@tanstack/react-query'

import { useApiClient } from '@/shared/api/apiClientContext'
import type { MeResponse } from '@/shared/api/types'

export const meQueryKey = ['me'] as const

export function useMe() {
  const api = useApiClient()
  return useQuery({
    queryKey: meQueryKey,
    queryFn: () => api.get<MeResponse>('/me'),
  })
}
