import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { CONSENT_TYPES, CONSENT_VERSION } from '@/consents'
import { useApiClient } from '@/shared/api/apiClientContext'
import { queryKeys } from '@/shared/api/queryKeys'
import type { ConsentType, ConsentsResponse, GrantConsentsRequest } from '@/shared/api/types'

export function useConsents() {
  const api = useApiClient()
  return useQuery({
    queryKey: queryKeys.consents,
    queryFn: () => api.get<ConsentsResponse>('/consents'),
  })
}

/** POST /consents for the texts this build shows (CONSENT_VERSION); the response is the new status. */
export function useGrantConsents() {
  const api = useApiClient()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (types: ConsentType[]) =>
      api.post<ConsentsResponse>('/consents', {
        types,
        version: CONSENT_VERSION,
      } satisfies GrantConsentsRequest),
    onSuccess: (status) => {
      queryClient.setQueryData(queryKeys.consents, status)
    },
  })
}

export function useRevokeConsent() {
  const api = useApiClient()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (type: ConsentType) => api.delete(`/consents/${type}`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.consents }),
  })
}

export interface ConsentState {
  /** Granted for the required version. */
  granted: Set<ConsentType>
  missing: ConsentType[]
  allGranted: boolean
  /** Some consent was given for an older version: show "terms have been updated". */
  hadOlderVersion: boolean
  /** No consent of any version: a fresh account. */
  isNewAccount: boolean
  /** The backend requires texts this build does not have: never send our version instead. */
  versionMismatch: boolean
}

export function consentState(status: ConsentsResponse): ConsentState {
  const granted = new Set(status.items.filter((i) => i.granted).map((i) => i.type))
  const missing = CONSENT_TYPES.filter((type) => !granted.has(type))
  return {
    granted,
    missing,
    allGranted: missing.length === 0,
    hadOlderVersion: status.items.some((i) => !i.granted && i.version !== null),
    isNewAccount: status.items.every((i) => i.version === null),
    versionMismatch: status.required_version !== CONSENT_VERSION,
  }
}
