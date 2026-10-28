import { Loader2Icon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { WakingHint } from './WakingHint'

/** `wakingHint`: waiting for our API (default), so explain a slow start after 1.5 s. */
export function FullPageSpinner({ wakingHint = true }: { wakingHint?: boolean }) {
  const { t } = useTranslation()
  return (
    <div role="status" className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
      <div className="flex justify-center gap-2">
        <Loader2Icon aria-hidden className="size-5 animate-spin" />
        <span>{t('auth.loading')}</span>
      </div>
      {wakingHint && <WakingHint />}
    </div>
  )
}
