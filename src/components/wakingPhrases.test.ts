import { describe, expect, it } from 'vitest'

import { seededRandom } from '@/test/seededRandom'

import { WAKING_PHRASES, shuffled } from './wakingPhrases'

describe('shuffled waking phrases', () => {
  it('gives the same order for the same seed, and every phrase exactly once', () => {
    const order = shuffled(WAKING_PHRASES, seededRandom(42))

    expect(shuffled(WAKING_PHRASES, seededRandom(42))).toEqual(order)
    expect([...order].sort()).toEqual([...WAKING_PHRASES].sort())
    expect(order).toEqual([
      'waiting.phrases.prepare',
      'waiting.phrases.tangles',
      'waiting.phrases.combing',
      'waiting.phrases.history',
      'waiting.phrases.shine',
    ])
  })

  it('starts with different phrases for different seeds', () => {
    const firsts = new Set(
      Array.from({ length: 20 }, (_, seed) => shuffled(WAKING_PHRASES, seededRandom(seed))[0]),
    )
    expect(firsts.size).toBeGreaterThan(1)
  })
})
