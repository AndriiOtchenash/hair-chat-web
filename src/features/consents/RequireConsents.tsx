import { Navigate, Outlet } from 'react-router'

import { ErrorAlert } from '@/components/ErrorAlert'
import { FullPageSpinner } from '@/components/FullPageSpinner'

import { consentState, useConsents } from './api'

/** Route guard for the chat: every consent of the current version, else /consents. */
export function RequireConsents() {
  const consents = useConsents()
  if (consents.isPending) return <FullPageSpinner />
  if (consents.isError) {
    return <ErrorAlert error={consents.error} onRetry={() => void consents.refetch()} />
  }
  const state = consentState(consents.data)
  if (!state.allGranted || state.versionMismatch) return <Navigate to="/consents" replace />
  return <Outlet />
}
