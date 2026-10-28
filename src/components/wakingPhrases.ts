/** i18n keys of the light-hearted phrases a waiting spinner rotates through (WakingHint). */
export const WAKING_PHRASES = [
  'waiting.phrases.prepare',
  'waiting.phrases.history',
  'waiting.phrases.combing',
  'waiting.phrases.shine',
  'waiting.phrases.tangles',
] as const

/** A shuffled copy of `items` (Fisher–Yates); `random` returns [0, 1) like Math.random. */
export function shuffled<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j] as T, result[i] as T]
  }
  return result
}
