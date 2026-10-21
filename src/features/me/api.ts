import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useApiClient } from '@/shared/api/apiClientContext'
import { queryKeys } from '@/shared/api/queryKeys'
import type { Locale, MeResponse, UpdateMeRequest } from '@/shared/api/types'

export function useMe() {
  const api = useApiClient()
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => api.get<MeResponse>('/me'),
  })
}

/** PATCH /me {locale}; the response replaces the cached /me. */
export function useUpdateLocale() {
  const api = useApiClient()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (locale: Locale) =>
      api.patch<MeResponse>('/me', { locale } satisfies UpdateMeRequest),
    onSuccess: (me) => {
      queryClient.setQueryData(queryKeys.me, me)
    },
  })
}
