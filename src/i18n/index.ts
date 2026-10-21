import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import en from './locales/en.json'
import pl from './locales/pl.json'
import ru from './locales/ru.json'
import uk from './locales/uk.json'

/** Same set as the backend `Locale` enum. */
export const SUPPORTED_LANGUAGES = ['uk', 'pl', 'en', 'ru'] as const
export type Language = (typeof SUPPORTED_LANGUAGES)[number]

export const LANGUAGE_NAMES: Record<Language, string> = {
  uk: 'Українська',
  pl: 'Polski',
  en: 'English',
  ru: 'Русский',
}

export const LANGUAGE_STORAGE_KEY = 'hair-chat.lang'

export const resources = {
  en: { translation: en },
  uk: { translation: uk },
  pl: { translation: pl },
  ru: { translation: ru },
} as const

export function isLanguage(value: string | undefined): value is Language {
  return SUPPORTED_LANGUAGES.includes(value as Language)
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    supportedLngs: SUPPORTED_LANGUAGES,
    nonExplicitSupportedLngs: true, // "uk-UA" -> "uk"
    load: 'languageOnly',
    fallbackLng: 'en',
    interpolation: { escapeValue: false }, // React escapes
    detection: {
      // An explicit choice (switcher) wins over the browser language. Detected languages are not
      // cached, so "no explicit choice" stays visible and the profile locale can apply instead.
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: [],
    },
  })

/** The language the user picked in this browser (switcher), or null if it was only detected. */
export function getExplicitLanguage(): Language | null {
  try {
    const value = localStorage.getItem(LANGUAGE_STORAGE_KEY) ?? undefined
    return isLanguage(value) ? value : null
  } catch {
    return null
  }
}

export function rememberExplicitLanguage(language: Language): void {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  } catch {
    // storage blocked: the choice lasts for this page only
  }
}

/** Current UI language as one of ours (falls back to en). */
export function currentLanguage(): Language {
  return isLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : 'en'
}

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng
})

export default i18n
