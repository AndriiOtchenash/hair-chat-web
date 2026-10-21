import { useTranslation } from 'react-i18next'

import { ApiError } from './errors'

/** Localized text for any error thrown by the API client (by ErrorBody.code), never raw server text. */
export function useErrorMessage() {
  const { t, i18n } = useTranslation()
  return (error: unknown): string => {
    const code = error instanceof ApiError ? error.code : 'unknown'
    const key = `errors.${code}`
    return i18n.exists(key) ? t(key as 'errors.unknown') : t('errors.unknown')
  }
}
