import { AlertCircleIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AiDisclosure } from '@/components/AiDisclosure'
import { FullPageSpinner } from '@/components/FullPageSpinner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LANGUAGE_NAMES } from '@/i18n'
import { useErrorMessage } from '@/shared/api/useErrorMessage'

import { useMe } from './useMe'

export function MePage() {
  const { t } = useTranslation()
  const errorMessage = useErrorMessage()
  const me = useMe()

  if (me.isPending) return <FullPageSpinner />

  if (me.isError) {
    return (
      <Alert variant="destructive">
        <AlertCircleIcon aria-hidden />
        <AlertTitle>{t('errors.title')}</AlertTitle>
        <AlertDescription>
          <p>{errorMessage(me.error)}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => void me.refetch()}>
            {t('me.retry')}
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  const { id, role, locale } = me.data
  return (
    <div className="space-y-4">
      <AiDisclosure />
      <Card>
        <CardHeader>
          <CardTitle>{t('me.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">{t('me.id')}</dt>
            <dd className="font-mono break-all">{id}</dd>
            <dt className="text-muted-foreground">{t('me.role')}</dt>
            <dd>{t(`me.roles.${role}`)}</dd>
            <dt className="text-muted-foreground">{t('me.locale')}</dt>
            <dd>{LANGUAGE_NAMES[locale]}</dd>
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}
