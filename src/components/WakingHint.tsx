import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import { useAfter } from '@/lib/useAfter'

/** After this long without an answer, a spinner explains the wait (a cold API start on Fly). */
export const WAKING_HINT_DELAY_MS = 3000

/** "The service is waking up…", shown under an API spinner once it has spun for 3 s. */
export function WakingHint({ className }: { className?: string }) {
  const { t } = useTranslation()
  const show = useAfter(WAKING_HINT_DELAY_MS)
  if (!show) return null
  return (
    <p className={cn('text-center text-sm text-muted-foreground', className)}>{t('auth.waking')}</p>
  )
}
