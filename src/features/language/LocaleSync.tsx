import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { consentState, useConsents } from '@/features/consents/api'
import { useMe } from '@/features/me/api'
import { currentLanguage, getExplicitLanguage } from '@/i18n'

import { useSaveLocale } from './useChangeLanguage'

/**
 * Once per session, reconciles the UI language with users.locale:
 * - new account (no consent ever given) -> the profile takes the UI language;
 * - returning user without an explicit choice in this browser -> the UI takes the profile locale.
 */
export function LocaleSync() {
  const { i18n } = useTranslation()
  const me = useMe()
  const consents = useConsents()
  const saveLocale = useSaveLocale()
  const done = useRef(false)

  useEffect(() => {
    if (done.current || !me.data || !consents.data) return
    done.current = true
    const ui = currentLanguage()
    if (me.data.locale === ui) return
    if (consentState(consents.data).isNewAccount) {
      saveLocale(ui)
    } else if (!getExplicitLanguage()) {
      void i18n.changeLanguage(me.data.locale)
    }
  }, [me.data, consents.data, saveLocale, i18n])

  return null
}
