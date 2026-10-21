import { useAuth0 } from '@auth0/auth0-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'

/** OAuth params Auth0 appends to redirect_uri (on success and on ?error=...). */
const AUTH_REDIRECT_PARAMS = ['code', 'state', 'error', 'error_description'] as const

function errorCode(error: Error): string {
  // OAuthError / auth0-spa-js GenericError carry the OAuth `error` code.
  const code = (error as { error?: unknown }).error
  return typeof code === 'string' ? code : 'unknown'
}

/**
 * Localized text of a failed Auth0 login (e.g. ?error=access_denied after the redirect), or null.
 * error_description goes to console.warn only: it is Auth0's English debug text.
 * Also strips the OAuth params from the URL so a reload does not replay them.
 */
export function useLoginError(): string | null {
  const { t, i18n } = useTranslation()
  const { error } = useAuth0()
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    if (!error) return
    const description = (error as { error_description?: unknown }).error_description
    console.warn('Auth0 login failed:', errorCode(error), description ?? error.message)
  }, [error])

  useEffect(() => {
    if (!AUTH_REDIRECT_PARAMS.some((p) => searchParams.has(p))) return
    const next = new URLSearchParams(searchParams)
    AUTH_REDIRECT_PARAMS.forEach((p) => {
      next.delete(p)
    })
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  if (!error) return null
  const key = `auth.errors.${errorCode(error)}`
  return i18n.exists(key) ? t(key as 'auth.errors.unknown') : t('auth.errors.unknown')
}
