import { LoaderCircleIcon, PlusIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink, useNavigate } from 'react-router'

import { ErrorAlert } from '@/components/ErrorAlert'
import { WakingHint } from '@/components/WakingHint'
import { Button } from '@/components/ui/button'
import { useErrorMessage } from '@/shared/api/useErrorMessage'

import { useConversations, useCreateConversation } from './api'

export function NewConversationButton({
  onCreated,
  className,
}: {
  onCreated?: () => void
  className?: string
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const create = useCreateConversation()
  const errorMessage = useErrorMessage()
  return (
    <div className={className}>
      <Button
        className="w-full"
        disabled={create.isPending}
        onClick={() => {
          create.mutate(undefined, {
            onSuccess: (conversation) => {
              onCreated?.()
              void navigate(`/chat/${conversation.id}`)
            },
          })
        }}
      >
        <PlusIcon aria-hidden />
        {t('chat.newConversation')}
      </Button>
      {create.isError && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {errorMessage(create.error)}
        </p>
      )}
    </div>
  )
}

/** Conversations, most recent first; `onNavigate` closes the mobile panel after a choice. */
export function ConversationList({ onNavigate }: { onNavigate?: () => void }) {
  const { t, i18n } = useTranslation()
  const conversations = useConversations()
  const dateFormat = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return (
    <nav
      aria-label={t('chat.conversations')}
      className="flex min-h-0 min-w-0 flex-1 flex-col gap-3"
    >
      <NewConversationButton onCreated={onNavigate} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {conversations.isPending && (
          <div role="status" className="flex flex-col items-center gap-2 py-4">
            <LoaderCircleIcon aria-hidden className="size-5 animate-spin text-muted-foreground" />
            <span className="sr-only">{t('auth.loading')}</span>
            <WakingHint className="px-2" />
          </div>
        )}
        {conversations.isError && (
          <ErrorAlert error={conversations.error} onRetry={() => void conversations.refetch()} />
        )}
        {conversations.isSuccess && (
          <>
            {conversations.data.pages[0]?.items.length === 0 && (
              <p className="px-2 text-sm text-muted-foreground">{t('chat.noConversations')}</p>
            )}
            <ul className="space-y-1">
              {conversations.data.pages
                .flatMap((page) => page.items)
                .map((conversation) => (
                  <li key={conversation.id}>
                    <NavLink
                      to={`/chat/${conversation.id}`}
                      onClick={onNavigate}
                      className="block min-w-0 rounded-md px-2 py-2 hover:bg-accent aria-[current=page]:bg-accent"
                    >
                      <span className="block truncate text-sm font-medium">
                        {conversation.title ?? t('chat.untitled')}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {dateFormat.format(new Date(conversation.last_message_at))}
                      </span>
                    </NavLink>
                  </li>
                ))}
            </ul>
            {conversations.hasNextPage && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full"
                disabled={conversations.isFetchingNextPage}
                onClick={() => void conversations.fetchNextPage()}
              >
                {t('chat.loadMore')}
              </Button>
            )}
          </>
        )}
      </div>
    </nav>
  )
}
