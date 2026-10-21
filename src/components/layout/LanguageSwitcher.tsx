import { LanguagesIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useChangeLanguage } from '@/features/language/useChangeLanguage'
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, currentLanguage, isLanguage } from '@/i18n'

export function LanguageSwitcher() {
  const { t } = useTranslation()
  const current = currentLanguage()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={t('language.label')}>
          <LanguagesIcon aria-hidden />
          {LANGUAGE_NAMES[current]}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <LanguageRadioItems />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Language choices for any dropdown (the switcher and the mobile menu). */
export function LanguageRadioItems() {
  const changeLanguage = useChangeLanguage()
  return (
    <DropdownMenuRadioGroup
      value={currentLanguage()}
      onValueChange={(lng) => {
        if (isLanguage(lng)) changeLanguage(lng)
      }}
    >
      {SUPPORTED_LANGUAGES.map((lng) => (
        <DropdownMenuRadioItem key={lng} value={lng} lang={lng}>
          {LANGUAGE_NAMES[lng]}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  )
}
