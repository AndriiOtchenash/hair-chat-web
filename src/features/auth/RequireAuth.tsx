import { useAuth0 } from '@auth0/auth0-react'
import { Navigate, Outlet } from 'react-router'

import { FullPageSpinner } from '@/components/FullPageSpinner'
import { LocaleSync } from '@/features/language/LocaleSync'

/** Route guard: unauthenticated users go to /login. */
export function RequireAuth() {
  const { isLoading, isAuthenticated } = useAuth0()
  if (isLoading) return <FullPageSpinner />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return (
    <>
      <LocaleSync />
      <Outlet />
    </>
  )
}
