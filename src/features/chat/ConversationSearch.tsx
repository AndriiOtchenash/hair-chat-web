import { InfoIcon, LoaderCircleIcon, SearchIcon, XIcon } from 'lucide-react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { ErrorAlert } from '@/components/ErrorAlert'
import { WakingHint } from '@/components/WakingHint'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { MAX_SEARCH_CHARS, useConversationSearch } from './api'
import type { FocusMessageState } from './useFocusMessage'

/** Marks the search input, so the mobile panel does not close on the Escape that clears it. */
export const SEARCH_INPUT_ATTR = 'data-conversation-search'

/** Search box above the conversation list; Escape or the cross clears it. */
export function SearchField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div role="search" className="relative min-w-0">
      <SearchIcon
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        ref={inputRef}
        {...{ [SEARCH_INPUT_ATTR]: '' }}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        aria-label={t('chat.search.label')}
        placeholder={t('chat.search.placeholder')}
        maxLength={MAX_SEARCH_CHARS}
        value={value}
        className="px-8 [&::-webkit-search-cancel-button]:appearance-none"
        onChange={(event) => {
          onChange(event.target.value)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && value !== '') {
            event.preventDefault()
            onChange('')
          }
        }}
      />
      {value !== '' && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-1/2 right-0.5 size-8 -translate-y-1/2"
          aria-label={t('chat.search.clear')}
          onClick={() => {
            onChange('')
            inputRef.current?.focus()
          }}
        >
          <XIcon aria-hidden />
        </Button>
      )}
    </div>
  )
}

/** Results for `q` in place of the list: best match per conversation, as the backend ranks them. */
export function SearchResultsPanel({ q, onNavigate }: { q: string; onNavigate?: () => void }) {
  const { t, i18n } = useTranslation()
  const search = useConversationSearch(q)
  const dateFormat = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' })

  if (search.isPending) {
    return (
      <div role="status" className="flex flex-col items-center gap-2 py-4">
        <LoaderCircleIcon aria-hidden className="size-5 animate-spin text-muted-foreground" />
        <span className="sr-only">{t('chat.search.searching')}</span>
        <WakingHint className="px-2" />
      </div>
    )
  }
  if (search.isError) {
    return <ErrorAlert error={search.error} onRetry={() => void search.refetch()} />
  }

  const { mode, items } = search.data
  return (
    <div className="min-w-0 space-y-2">
      {mode === 'text' && (
        <p className="flex items-start gap-1.5 px-2 text-xs text-muted-foreground">
          <InfoIcon aria-hidden className="mt-px size-3.5 shrink-0" />
          {t('chat.search.textMode')}
        </p>
      )}
      {items.length === 0 ? (
        <p role="status" className="px-2 text-sm text-muted-foreground">
          {t('chat.search.empty')}
        </p>
      ) : (
        <ul aria-label={t('chat.search.results')} className="space-y-1">
          {items.map((hit) => (
            <li key={hit.message_id}>
              <Link
                to={`/chat/${hit.conversation_id}`}
                state={{ focusMessageId: hit.message_id } satisfies FocusMessageState}
                onClick={onNavigate}
                className="block min-w-0 rounded-md px-2 py-2 hover:bg-accent"
              >
                <span className="block truncate text-sm font-medium">
                  {hit.title ?? t('chat.untitled')}
                </span>
                <span className="line-clamp-2 text-xs break-words text-muted-foreground">
                  {hit.snippet}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {dateFormat.format(new Date(hit.created_at))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
