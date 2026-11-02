import { BookOpenIcon, ScissorsIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import type { AnswerSource } from '@/shared/api/sse'
import type { MessageRole } from '@/shared/api/types'

import type { AnswerMeta } from './api'
import { Markdown } from './Markdown'
import { MESSAGE_ID_ATTR } from './useFocusMessage'

function isHttpUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

function Sources({ sources }: { sources: AnswerSource[] }) {
  const { t } = useTranslation()
  return (
    <div className="mt-3 border-t pt-2 text-sm">
      <p className="flex items-center gap-1 font-medium text-muted-foreground">
        <BookOpenIcon aria-hidden className="size-4 shrink-0" />
        {t('chat.sources')}
      </p>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        {sources.map((source) => (
          <li key={source.slug} className="min-w-0 break-words">
            {source.url && isHttpUrl(source.url) ? (
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="underline underline-offset-4"
              >
                {source.title}
              </a>
            ) : (
              source.title
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * One message. A saved one carries its `id` and can take the focus: a search result scrolls to it
 * and rings it in yellow for a moment (useFocusMessage sets data-highlighted, the
 * `search-highlight` utility in index.css draws it).
 */
export function MessageBubble({
  id,
  role,
  content,
  meta,
}: {
  id?: string
  role: MessageRole
  content: string
  meta?: AnswerMeta
}) {
  const { t } = useTranslation()
  const isUser = role === 'user'
  return (
    <li
      {...(id && { [MESSAGE_ID_ATTR]: id, tabIndex: -1 })}
      className={cn(
        'group flex min-w-0 rounded-lg outline-none',
        isUser ? 'justify-end' : 'justify-start',
      )}
    >
      <div
        className={cn(
          'max-w-[85%] min-w-0 rounded-lg px-3 py-2',
          isUser ? 'bg-primary text-primary-foreground' : 'border bg-card',
          'group-data-highlighted:search-highlight',
        )}
      >
        <span className="sr-only">{isUser ? t('chat.you') : t('chat.assistant')}: </span>
        {isUser ? (
          <p className="break-words whitespace-pre-wrap">{content}</p>
        ) : (
          <Markdown>{content}</Markdown>
        )}
        {meta?.truncated && (
          <p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
            <ScissorsIcon aria-hidden className="size-4 shrink-0" />
            {t('chat.truncated')}
          </p>
        )}
        {meta && meta.sources.length > 0 && <Sources sources={meta.sources} />}
      </div>
    </li>
  )
}
