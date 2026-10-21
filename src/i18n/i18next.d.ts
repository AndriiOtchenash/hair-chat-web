import 'i18next'

import type en from './locales/en.json'

// Typed keys: t('me.titel') is a compile error. en.json is the reference locale.
declare module 'i18next' {
  interface CustomTypeOptions {
    resources: { translation: typeof en }
  }
}
