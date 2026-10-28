import { LoaderCircleIcon, PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMatch, useNavigate } from 'react-router'
import { toast } from 'sonner'

import { ErrorAlert } from '@/components/ErrorAlert'
import { WakingHint } from '@/components/WakingHint'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/shared/api/errors'
import type { ConversationOut } from '@/shared/api/types'
import { useErrorMessage } from '@/shared/api/useErrorMessage'

import {
  isNotFound,
  useConversations,
  useCreateConversation,
  useDeleteConversation,
  useRenameConversation,
} from './api'
import { ConversationItem } from './ConversationItem'

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

/** Toast for a failed rename/delete: 409 = still answering, 404 = already gone (and dropped). */
function useManageErrorToast() {
  const { t } = useTranslation()
  const errorMessage = useErrorMessage()
  return (error: unknown) => {
    if (error instanceof ApiError && error.code === 'conversation_busy') {
      toast.error(t('chat.manage.busy'))
    } else if (isNotFound(error)) {
      toast(t('chat.manage.gone'))
    } else {
      toast.error(errorMessage(error))
    }
  }
}

/**
 * Rename/delete for the list. A conversation that is open and gets deleted (or turns out to be
 * gone) sends the user to /chat, where a new one starts.
 */
function useManageConversations() {
  const navigate = useNavigate()
  const openId = useMatch('/chat/:id')?.params.id
  const notify = useManageErrorToast()
  const leaveIfOpen = (id: string) => {
    if (id === openId) void navigate('/chat', { replace: true })
  }
  const onError = (error: unknown, id: string) => {
    notify(error)
    if (isNotFound(error)) leaveIfOpen(id)
  }
  return {
    rename: useRenameConversation({ onError }),
    remove: useDeleteConversation({ onSuccess: leaveIfOpen, onError }),
  }
}

/** Conversations, most recent first; `onNavigate` closes the mobile panel after a choice. */
export function ConversationList({ onNavigate }: { onNavigate?: () => void }) {
  const { t, i18n } = useTranslation()
  const conversations = useConversations()
  const { rename, remove } = useManageConversations()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<ConversationOut | null>(null)
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
                    <ConversationItem
                      conversation={conversation}
                      date={dateFormat.format(new Date(conversation.last_message_at))}
                      editing={editingId === conversation.id}
                      onNavigate={onNavigate}
                      onStartRename={() => {
                        setEditingId(conversation.id)
                      }}
                      onRename={(title) => {
                        setEditingId(null)
                        rename.mutate({ id: conversation.id, title })
                      }}
                      onCancelRename={() => {
                        setEditingId(null)
                      }}
                      onDelete={() => {
                        setToDelete(conversation)
                      }}
                    />
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
      <AlertDialog
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open) setToDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('chat.manage.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('chat.manage.deleteText', { title: toDelete?.title ?? t('chat.untitled') })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('chat.manage.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (toDelete) remove.mutate(toDelete.id)
              }}
            >
              {t('chat.manage.deleteConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </nav>
  )
}
