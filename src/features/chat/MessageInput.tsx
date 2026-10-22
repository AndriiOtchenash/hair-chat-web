import { SendIcon, SquareIcon } from 'lucide-react'
import { useId, type SyntheticEvent, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

import { MAX_MESSAGE_CHARS } from './api'

export function MessageInput({
  value,
  onChange,
  onSend,
  onStop,
  generating,
}: {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  onStop: () => void
  generating: boolean
}) {
  const { t } = useTranslation()
  const counterId = useId()
  const canSend = !generating && value.trim().length > 0 && value.length <= MAX_MESSAGE_CHARS

  function submit(event?: SyntheticEvent) {
    event?.preventDefault()
    if (canSend) onSend()
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter is a new line; Enter that confirms an IME composition is neither.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <form onSubmit={submit} className="flex min-w-0 items-end gap-2">
      <div className="min-w-0 flex-1">
        <Textarea
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
          }}
          onKeyDown={onKeyDown}
          disabled={generating}
          maxLength={MAX_MESSAGE_CHARS}
          rows={1}
          placeholder={t('chat.inputPlaceholder')}
          aria-label={t('chat.inputLabel')}
          aria-describedby={counterId}
          className="max-h-40 min-h-10 resize-none"
        />
        <p id={counterId} className="mt-1 text-right text-xs text-muted-foreground">
          {t('chat.counter', { length: value.length, max: MAX_MESSAGE_CHARS })}
        </p>
      </div>
      {generating ? (
        <Button type="button" variant="outline" onClick={onStop} className="mb-5 shrink-0">
          <SquareIcon aria-hidden />
          {t('chat.stop')}
        </Button>
      ) : (
        <Button type="submit" disabled={!canSend} className="mb-5 shrink-0">
          <SendIcon aria-hidden />
          <span className="sr-only sm:not-sr-only">{t('chat.send')}</span>
        </Button>
      )}
    </form>
  )
}
