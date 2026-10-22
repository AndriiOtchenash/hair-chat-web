import type { Language } from '@/i18n'

export interface Helpline {
  /** Shown as is (a phone number or a site name). */
  label: string
  href: string
  /** i18n key under safety.lines describing who answers. */
  descriptionKey: 'emotionalCrisis' | 'lifelineUkraine' | 'emergency' | 'findAHelpline'
}

// VERIFY BEFORE PRODUCTION: numbers, names and hours change; check every entry with the official
// sources (and legal) before release. Language-specific lines first, then the ones for everyone.
export const HELPLINES_BY_LANGUAGE: Partial<Record<Language, Helpline[]>> = {
  pl: [{ label: '116 123', href: 'tel:116123', descriptionKey: 'emotionalCrisis' }],
  uk: [{ label: '7333', href: 'tel:7333', descriptionKey: 'lifelineUkraine' }],
}

export const HELPLINES_FOR_ALL: Helpline[] = [
  { label: '112', href: 'tel:112', descriptionKey: 'emergency' },
  {
    label: 'findahelpline.com',
    href: 'https://findahelpline.com',
    descriptionKey: 'findAHelpline',
  },
]

export function helplinesFor(language: Language): Helpline[] {
  return [...(HELPLINES_BY_LANGUAGE[language] ?? []), ...HELPLINES_FOR_ALL]
}
