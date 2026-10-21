import { describe, expect, it } from 'vitest'

import { SUPPORTED_LANGUAGES } from '@/i18n'

import {
  CONSENT_TYPES,
  CONSENT_VERSION,
  consentFileVersions,
  getConsentTexts,
  parseConsentTexts,
} from '.'

describe('consent texts', () => {
  it('has a folder for the version sent to the backend', () => {
    expect(consentFileVersions()).toContain(CONSENT_VERSION)
  })

  it.each(SUPPORTED_LANGUAGES)('%s has a title, summary and body for every consent', (lng) => {
    const texts = getConsentTexts(lng)
    for (const type of CONSENT_TYPES) {
      expect(texts[type].title, type).not.toBe('')
      expect(texts[type].summary, type).not.toBe('')
      expect(texts[type].body.startsWith(texts[type].summary), type).toBe(true)
      expect(texts[type].body, type).not.toContain('<!--')
    }
  })

  it('names the AI providers and the 30-day retention in every language', () => {
    for (const lng of SUPPORTED_LANGUAGES) {
      const body = getConsentTexts(lng).ai_processing.body
      expect(body, lng).toMatch(/Gemini/)
      expect(body, lng).toMatch(/Groq/)
      expect(body, lng).toMatch(/OpenAI/)
      expect(body, lng).toMatch(/30/)
    }
  })

  it('rejects a file with a missing section', () => {
    const md = '<!-- consent:age_18 -->\n\n## A\n\nSummary.\n'
    expect(() => parseConsentTexts(md)).toThrow(/health_data/)
  })
})
