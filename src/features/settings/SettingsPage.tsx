import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { toast } from 'sonner'

import { ErrorAlert } from '@/components/ErrorAlert'
import { FullPageSpinner } from '@/components/FullPageSpinner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { CONSENT_TYPES } from '@/consents'
import { consentState, useConsents, useRevokeConsent } from '@/features/consents/api'
import { useConsentTexts } from '@/features/consents/useConsentTexts'
import { useChangeLanguage } from '@/features/language/useChangeLanguage'
import { useMe } from '@/features/me/api'
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, currentLanguage } from '@/i18n'
import type { ConsentItem, ConsentType } from '@/shared/api/types'
import { useErrorMessage } from '@/shared/api/useErrorMessage'

export function SettingsPage() {
  const { t } = useTranslation()
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{t('settings.title')}</h1>
      <LanguageCard />
      <ConsentsCard />
      <AccountCard />
    </div>
  )
}

function LanguageCard() {
  const { t } = useTranslation()
  const changeLanguage = useChangeLanguage()
  const current = currentLanguage()
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.language')}</CardTitle>
      </CardHeader>
      <CardContent>
        <fieldset className="flex flex-wrap gap-x-6 gap-y-2">
          <legend className="sr-only">{t('settings.language')}</legend>
          {SUPPORTED_LANGUAGES.map((lng) => (
            <label key={lng} lang={lng} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="language"
                value={lng}
                checked={current === lng}
                onChange={() => {
                  changeLanguage(lng)
                }}
                className="size-4 accent-primary"
              />
              {LANGUAGE_NAMES[lng]}
            </label>
          ))}
        </fieldset>
      </CardContent>
    </Card>
  )
}

function ConsentsCard() {
  const { t } = useTranslation()
  const consents = useConsents()

  let content
  if (consents.isPending) content = <FullPageSpinner />
  else if (consents.isError) {
    content = <ErrorAlert error={consents.error} onRetry={() => void consents.refetch()} />
  } else {
    const byType = new Map(consents.data.items.map((item) => [item.type, item]))
    content = (
      <ul className="divide-y">
        {CONSENT_TYPES.map((type) => (
          <ConsentRow key={type} type={type} item={byType.get(type)} />
        ))}
      </ul>
    )
  }

  const missing = consents.data ? !consentState(consents.data).allGranted : false
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.consents')}</CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
      {missing && (
        <CardFooter>
          <Button asChild>
            <Link to="/consents">{t('settings.grant')}</Link>
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}

function ConsentRow({ type, item }: { type: ConsentType; item: ConsentItem | undefined }) {
  const { t, i18n } = useTranslation()
  const texts = useConsentTexts()
  const revoke = useRevokeConsent()
  const errorMessage = useErrorMessage()
  const title = texts[type].title

  let status
  if (item?.granted && item.granted_at) {
    const date = new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: 'medium' }).format(
      new Date(item.granted_at),
    )
    status = (
      <Badge variant="secondary" className="whitespace-normal">
        {t('consents.status.granted', { date })}
      </Badge>
    )
  } else if (item?.version) {
    status = (
      <Badge variant="outline" className="whitespace-normal">
        {t('consents.status.outdated')}
      </Badge>
    )
  } else {
    status = (
      <Badge variant="destructive" className="whitespace-normal">
        {t('consents.status.missing')}
      </Badge>
    )
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3" aria-label={title}>
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {status}
      </div>
      {item?.version && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={revoke.isPending}>
              {t('settings.revoke')}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('settings.revokeTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                <strong className="block text-foreground">{title}</strong>
                {t('settings.revokeText')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('settings.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  revoke.mutate(type, {
                    onSuccess: () => toast.success(t('settings.revoked')),
                    onError: (error) => toast.error(errorMessage(error)),
                  })
                }}
              >
                {t('settings.revokeConfirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </li>
  )
}

function AccountCard() {
  const { t } = useTranslation()
  const me = useMe()
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('me.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {me.isPending && <FullPageSpinner />}
        {me.isError && <ErrorAlert error={me.error} onRetry={() => void me.refetch()} />}
        {me.data && (
          <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">{t('me.id')}</dt>
            <dd className="font-mono break-all">{me.data.id}</dd>
            <dt className="text-muted-foreground">{t('me.role')}</dt>
            <dd>{t(`me.roles.${me.data.role}`)}</dd>
          </dl>
        )}
      </CardContent>
    </Card>
  )
}
