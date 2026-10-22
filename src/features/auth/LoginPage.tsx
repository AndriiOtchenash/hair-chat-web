import { useAuth0 } from '@auth0/auth0-react'
import { AlertCircleIcon, CircleCheckIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Navigate, useSearchParams } from 'react-router'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

import { useLoginError } from './useLoginError'

/** Auth0 connection name for "Sign in with Google" (skips the Universal Login chooser). */
export const GOOGLE_CONNECTION = 'google-oauth2'

export function LoginPage() {
  const { t } = useTranslation()
  const { isAuthenticated, loginWithRedirect } = useAuth0()
  const loginError = useLoginError()
  // Auth0 logout after DELETE /me returns here (ACCOUNT_DELETED_PATH).
  const [searchParams] = useSearchParams()
  const accountDeleted = searchParams.get('deleted') === '1'

  if (isAuthenticated) return <Navigate to="/" replace />

  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle>{t('auth.signInTitle')}</CardTitle>
        <CardDescription>{t('auth.signInHint')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {accountDeleted && (
          <Alert>
            <CircleCheckIcon aria-hidden />
            <AlertTitle>{t('auth.accountDeleted')}</AlertTitle>
            <AlertDescription>{t('auth.accountDeletedText')}</AlertDescription>
          </Alert>
        )}
        {loginError && (
          <Alert variant="destructive">
            <AlertCircleIcon aria-hidden />
            <AlertDescription>{loginError}</AlertDescription>
          </Alert>
        )}
        <Button
          className="w-full"
          onClick={() =>
            void loginWithRedirect({ authorizationParams: { connection: GOOGLE_CONNECTION } })
          }
        >
          <GoogleIcon />
          {t('auth.signInWithGoogle')}
        </Button>
      </CardContent>
    </Card>
  )
}

function GoogleIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-4">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.5 14.6 2.5 12 2.5 6.8 2.5 2.6 6.7 2.6 12s4.2 9.5 9.4 9.5c5.4 0 9-3.8 9-9.2 0-.6-.07-1.1-.16-1.6H12z"
      />
    </svg>
  )
}
