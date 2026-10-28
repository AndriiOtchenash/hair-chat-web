import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import { useAfter } from '@/lib/useAfter'

import { WAKING_PHRASES } from './wakingPhrases'

/** After this long without an answer, a spinner explains the wait (a cold API start on Fly). */
export const WAKING_HINT_DELAY_MS = 3000
/** How long each light-hearted phrase stays before the next one fades in. */
export const WAKING_PHRASE_MS = 2500
/** After this long (since the spinner appeared) the jokes stop: "taking longer than usual". */
export const WAKING_LONGER_MS = 10_000

/**
 * Shown under an API spinner once it has spun for 3 s: friendly phrases that change every 2.5 s,
 * then a calm "taking longer than usual" at 10 s. Screen readers hear only the first phrase and
 * the "longer" one (the rotating text is aria-hidden); the fade is skipped with reduced motion.
 */
export function WakingHint({ className }: { className?: string }) {
  const { t } = useTranslation()
  const show = useAfter(WAKING_HINT_DELAY_MS)
  const longer = useAfter(WAKING_LONGER_MS)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!show || longer) return
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % WAKING_PHRASES.length)
    }, WAKING_PHRASE_MS)
    return () => {
      clearInterval(timer)
    }
  }, [show, longer])

  if (!show) return null
  const visible = longer ? t('waiting.longer') : t(WAKING_PHRASES[index] ?? WAKING_PHRASES[0])
  const announced = longer ? t('waiting.longer') : t(WAKING_PHRASES[0])
  return (
    <div className={cn('text-center text-sm text-muted-foreground', className)}>
      <p
        key={longer ? 'longer' : index}
        aria-hidden
        className="motion-safe:animate-in motion-safe:duration-500 motion-safe:fade-in"
      >
        {visible}
      </p>
      <p aria-live="polite" className="sr-only">
        {announced}
      </p>
    </div>
  )
}
