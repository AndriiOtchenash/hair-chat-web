import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useApiClient } from '@/shared/api/apiClientContext'
import { queryKeys } from '@/shared/api/queryKeys'
import type { DeleteMeRequest, Locale, MeResponse, UpdateMeRequest } from '@/shared/api/types'

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

export const EXPORT_FALLBACK_FILENAME = 'hair-chat-export.json'

/** Hands a Blob to the browser as a file download (temporary object URL + <a download>). */
function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.append(link)
  link.click()
  link.remove()
  // Revoke after the click has been handled, or some browsers cancel the download.
  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 0)
}

/** GET /me/export (Bearer via the API client) saved as a file. */
export function useExportData() {
  const api = useApiClient()
  return useMutation({
    mutationFn: async () => {
      const { blob, filename } = await api.download('/me/export')
      saveBlob(blob, filename ?? EXPORT_FALLBACK_FILENAME)
    },
  })
}

/** DELETE /me: the API always gets the literal "DELETE", whatever word the UI asked for. */
export function useDeleteAccount() {
  const api = useApiClient()
  return useMutation({
    mutationFn: () => api.delete('/me', { confirm: 'DELETE' } satisfies DeleteMeRequest),
  })
}
