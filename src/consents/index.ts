import type { Language } from '@/i18n'
import type { ConsentType } from '@/shared/api/types'

/**
 * Version of the consent texts shown and sent in POST /consents. Must equal the backend's
 * CONSENT_VERSION and the folder name below (see src/consents/README.md).
 */
export const CONSENT_VERSION = '2026-10-v1'

export const CONSENT_TYPES = [
  'age_18',
  'health_data',
  'ai_processing',
] as const satisfies readonly ConsentType[]

export interface ConsentText {
  title: string
  /** First paragraph: the short text next to the checkbox. */
  summary: string
  /** Everything after the title (summary included), markdown. */
  body: string
}

export type ConsentTexts = Record<ConsentType, ConsentText>

/** `{"./2026-10-v1/uk.md": "..."}`, bundled at build time. */
const FILES = import.meta.glob<string>('./*/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
})

const MARKER = /^<!--\s*consent:(\w+)\s*-->\s*$/m

/** Splits a texts file into its `<!-- consent:<type> -->` sections; throws on a broken file. */
export function parseConsentTexts(markdown: string): ConsentTexts {
  const parts = markdown.split(MARKER)
  const texts: Partial<ConsentTexts> = {}
  // split() with a capture group: [preamble, type1, section1, type2, section2, ...]
  for (let i = 1; i < parts.length; i += 2) {
    const type = parts[i] as ConsentType
    const section = (parts[i + 1] ?? '').trim()
    const heading = /^##\s+(.+)$/m.exec(section)
    if (!heading?.[1]) throw new Error(`Consent section "${type}" has no "## title"`)
    const body = section.slice(heading.index + heading[0].length).trim()
    const summary = body.split(/\n\s*\n/)[0]?.trim() ?? ''
    if (!summary) throw new Error(`Consent section "${type}" has no summary paragraph`)
    texts[type] = { title: heading[1].trim(), summary, body }
  }
  for (const type of CONSENT_TYPES) {
    if (!texts[type]) throw new Error(`Consent section "${type}" is missing`)
  }
  return texts as ConsentTexts
}

export function consentFileVersions(): string[] {
  return [...new Set(Object.keys(FILES).map((path) => path.split('/')[1] ?? ''))]
}

export function getConsentTexts(language: Language, version = CONSENT_VERSION): ConsentTexts {
  const markdown = FILES[`./${version}/${language}.md`]
  if (markdown === undefined) throw new Error(`No consent texts for ${version}/${language}`)
  return parseConsentTexts(markdown)
}
