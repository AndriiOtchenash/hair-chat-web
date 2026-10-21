import { useAuth0 } from '@auth0/auth0-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { useUpdateLocale } from '@/features/me/api'
import { rememberExplicitLanguage, type Language } from '@/i18n'

/** Saves the language to the profile (PATCH /me); a failure only shows a toast, never breaks the UI. */
export function useSaveLocale() {
  const { i18n } = useTranslation()
  const updateLocale = useUpdateLocale()
  return (language: Language) => {
    updateLocale.mutate(language, {
      onError: () => {
        // i18n.t, not the rendered t: show it in the language just switched to.
        toast.error(i18n.t('language.saveFailed'))
      },
    })
  }
}

/** Explicit language choice: switch the UI now, remember it in this browser, save it to the profile. */
export function useChangeLanguage() {
  const { i18n } = useTranslation()
  const { isAuthenticated } = useAuth0()
  const saveLocale = useSaveLocale()
  return (language: Language) => {
    rememberExplicitLanguage(language)
    void i18n.changeLanguage(language)
    if (isAuthenticated) saveLocale(language)
  }
}
