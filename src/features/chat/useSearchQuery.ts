import { useDebouncedValue } from '@/lib/useDebouncedValue'

import { MIN_SEARCH_CHARS } from './api'

/** Pause after the last keystroke before a search request goes out. */
export const SEARCH_DEBOUNCE_MS = 300

/**
 * The search text a list shows results for: the trimmed input after SEARCH_DEBOUNCE_MS, or ''
 * while the input is too short (clearing it shows the list again at once).
 */
export function useSearchQuery(input: string): string {
  const debounced = useDebouncedValue(input.trim(), SEARCH_DEBOUNCE_MS)
  return input.trim().length >= MIN_SEARCH_CHARS && debounced.length >= MIN_SEARCH_CHARS
    ? debounced
    : ''
}
