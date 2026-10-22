import { HeartHandshakeIcon, XIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { currentLanguage } from '@/i18n'

import { helplinesFor } from './helplines'

/** Shown when the backend sends safety_notice (moderation: self-harm, ADR 0004 in the API). */
export function SafetyNoticeCard({ onDismiss }: { onDismiss: () => void }) {
  // useTranslation re-renders on a language switch, so the lines follow the UI language.
  const { t } = useTranslation()
  const lines = helplinesFor(currentLanguage())
  return (
    <li>
      <section
        aria-labelledby="safety-notice-title"
        className="relative rounded-lg border border-amber-300 bg-amber-50 p-4 pr-10 text-amber-950"
      >
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 size-8"
          onClick={onDismiss}
          aria-label={t('safety.dismiss')}
        >
          <XIcon aria-hidden />
        </Button>
        <h2 id="safety-notice-title" className="flex items-center gap-2 font-semibold">
          <HeartHandshakeIcon aria-hidden className="size-5 shrink-0" />
          {t('safety.title')}
        </h2>
        <p className="mt-2 text-sm">{t('safety.text')}</p>
        <ul className="mt-3 space-y-2 text-sm">
          {lines.map((line) => (
            <li key={line.href} className="min-w-0 break-words">
              <a
                href={line.href}
                className="font-semibold underline underline-offset-4"
                {...(line.href.startsWith('http')
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : {})}
              >
                {line.label}
              </a>{' '}
              — {t(`safety.lines.${line.descriptionKey}`)}
            </li>
          ))}
        </ul>
      </section>
    </li>
  )
}
