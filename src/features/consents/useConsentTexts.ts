import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { getConsentTexts } from '@/consents'
import { currentLanguage } from '@/i18n'

/** Consent texts of CONSENT_VERSION in the UI language. */
export function useConsentTexts() {
  const { i18n } = useTranslation()
  const language = i18n.resolvedLanguage
  // eslint-disable-next-line react-hooks/exhaustive-deps -- recompute when the UI language changes
  return useMemo(() => getConsentTexts(currentLanguage()), [language])
}
