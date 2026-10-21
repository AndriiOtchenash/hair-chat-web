import { AlertCircleIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useErrorMessage } from '@/shared/api/useErrorMessage'

/** An API error as localized text (by code), with an optional retry. */
export function ErrorAlert({
  error,
  onRetry,
  title,
  children,
}: {
  error?: unknown
  onRetry?: () => void
  title?: string
  children?: ReactNode
}) {
  const { t } = useTranslation()
  const errorMessage = useErrorMessage()
  return (
    <Alert variant="destructive">
      <AlertCircleIcon aria-hidden />
      <AlertTitle>{title ?? t('errors.title')}</AlertTitle>
      <AlertDescription>
        <p>{children ?? errorMessage(error)}</p>
        {onRetry && (
          <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
            {t('me.retry')}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  )
}
