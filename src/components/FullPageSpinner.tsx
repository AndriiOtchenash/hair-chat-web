import { Loader2Icon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function FullPageSpinner() {
  const { t } = useTranslation()
  return (
    <div role="status" className="flex justify-center gap-2 py-16 text-muted-foreground">
      <Loader2Icon aria-hidden className="size-5 animate-spin" />
      <span>{t('auth.loading')}</span>
    </div>
  )
}
