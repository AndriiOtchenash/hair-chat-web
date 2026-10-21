import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'

import { ErrorAlert } from '@/components/ErrorAlert'
import { FullPageSpinner } from '@/components/FullPageSpinner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { CONSENT_TYPES, type ConsentText } from '@/consents'
import type { ConsentType } from '@/shared/api/types'

import { consentState, useConsents, useGrantConsents } from './api'
import { ConsentMarkdown } from './ConsentText'
import { useConsentTexts } from './useConsentTexts'

export function ConsentsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const consents = useConsents()
  const grant = useGrantConsents()
  const texts = useConsentTexts()
  const [checked, setChecked] = useState<ReadonlySet<ConsentType>>(new Set())

  if (consents.isPending) return <FullPageSpinner />
  if (consents.isError) {
    return <ErrorAlert error={consents.error} onRetry={() => void consents.refetch()} />
  }

  const state = consentState(consents.data)
  if (state.versionMismatch) {
    return <ErrorAlert title={t('consents.outdatedTitle')}>{t('consents.outdated')}</ErrorAlert>
  }
  if (state.allGranted && !grant.isPending) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle>{t('consents.allGranted')}</CardTitle>
        </CardHeader>
        <CardFooter>
          <Button asChild>
            <Link to="/chat">{t('consents.toChat')}</Link>
          </Button>
        </CardFooter>
      </Card>
    )
  }

  const isChecked = (type: ConsentType) => state.granted.has(type) || checked.has(type)
  const toggle = (type: ConsentType, on: boolean) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (on) next.add(type)
      else next.delete(type)
      return next
    })
  }
  const allChecked = CONSENT_TYPES.every(isChecked)

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle>
          <h1>{state.hadOlderVersion ? t('consents.updatedTitle') : t('consents.title')}</h1>
        </CardTitle>
        <CardDescription>
          {state.hadOlderVersion ? t('consents.updatedIntro') : t('consents.intro')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {CONSENT_TYPES.map((type) => (
          <div key={type} className="flex items-start gap-3">
            <Checkbox
              id={`consent-${type}`}
              className="mt-0.5"
              checked={isChecked(type)}
              disabled={state.granted.has(type) || grant.isPending}
              onCheckedChange={(value) => {
                toggle(type, value === true)
              }}
            />
            <div className="space-y-1">
              <Label htmlFor={`consent-${type}`} className="leading-snug font-normal">
                {texts[type].summary}
              </Label>
              <ConsentDetails text={texts[type]} />
            </div>
          </div>
        ))}
        {grant.isError && <ErrorAlert error={grant.error} />}
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          disabled={!allChecked || grant.isPending}
          onClick={() => {
            grant.mutate(state.missing, {
              onSuccess: () => void navigate('/chat', { replace: true }),
            })
          }}
        >
          {t('consents.continue')}
        </Button>
      </CardFooter>
    </Card>
  )
}

function ConsentDetails({ text }: { text: ConsentText }) {
  const { t } = useTranslation()
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="link" size="sm" className="h-auto p-0">
          {t('consents.more')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{text.title}</DialogTitle>
          <DialogDescription className="sr-only">{text.summary}</DialogDescription>
        </DialogHeader>
        <ConsentMarkdown>{text.body}</ConsentMarkdown>
      </DialogContent>
    </Dialog>
  )
}
