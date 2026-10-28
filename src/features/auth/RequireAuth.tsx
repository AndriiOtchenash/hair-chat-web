import { useAuth0 } from '@auth0/auth0-react'
import { Navigate, Outlet } from 'react-router'
import { useTranslation } from 'react-i18next'

import { ErrorAlert } from '@/components/ErrorAlert'
import { FullPageSpinner } from '@/components/FullPageSpinner'
import { LocaleSync } from '@/features/language/LocaleSync'
import { useAfter } from '@/lib/useAfter'

/**
 * Auth0 restores the session on load; if that takes this long (Auth0 unreachable), stop
 * spinning and offer a reload instead. auth0-spa-js itself gives up only after 60 s.
 */
export const AUTH_LOADING_LIMIT_MS = 20_000

/** Route guard: unauthenticated users go to /login. */
export function RequireAuth() {
  const { isLoading, isAuthenticated } = useAuth0()
  if (isLoading) return <AuthLoading />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return (
    <>
      <LocaleSync />
      <Outlet />
    </>
  )
}

function AuthLoading() {
  const { t } = useTranslation()
  const tooLong = useAfter(AUTH_LOADING_LIMIT_MS)
  if (!tooLong) return <FullPageSpinner wakingHint={false} />
  return (
    <ErrorAlert
      onRetry={() => {
        window.location.reload()
      }}
    >
      {t('auth.tooSlow')}
    </ErrorAlert>
  )
}
