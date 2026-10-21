import { BotIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

/**
 * EU AI Act art. 50: people must be told they are interacting with an AI system.
 * Must stay visible wherever the chat is shown.
 */
export function AiDisclosure({ className }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <p
      role="note"
      className={cn(
        'flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-muted-foreground',
        className,
      )}
    >
      <BotIcon aria-hidden className="size-4 shrink-0" />
      {t('aiDisclosure.text')}
    </p>
  )
}
