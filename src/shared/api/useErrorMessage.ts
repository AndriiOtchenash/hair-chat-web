import { useTranslation } from 'react-i18next'

import { ApiError } from './errors'
import { isGatewayError } from './retry'

/** Localized text for any error thrown by the API client (by ErrorBody.code), never raw server text. */
export function useErrorMessage() {
  const { t, i18n } = useTranslation()
  return (error: unknown): string => {
    // A bare 502/503/504 from the proxy: the service is down or still starting.
    if (isGatewayError(error)) return t('errors.service_unavailable')
    const code = error instanceof ApiError ? error.code : 'unknown'
    const key = `errors.${code}`
    return i18n.exists(key) ? t(key as 'errors.unknown') : t('errors.unknown')
  }
}
