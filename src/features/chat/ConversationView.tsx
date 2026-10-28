import { LoaderCircleIcon, RefreshCwIcon } from 'lucide-react'
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'

import { ErrorAlert } from '@/components/ErrorAlert'
import { WakingHint } from '@/components/WakingHint'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/shared/api/errors'
import { useErrorMessage } from '@/shared/api/useErrorMessage'

import { useAnswerMeta, useMessages } from './api'
import { MessageBubble } from './MessageBubble'
import { MessageInput } from './MessageInput'
import { SafetyNoticeCard } from './SafetyNoticeCard'
import { useSendMessage, type SendState } from './useSendMessage'

/** Route element for /chat/:id; keyed by id so a new conversation starts with fresh state. */
export function ConversationRoute() {
  const { id = '' } = useParams()
  return <ConversationView key={id} conversationId={id} />
}

const NEAR_BOTTOM_PX = 80

function useSendErrorText(sendError: SendState['error']): string | null {
  const { t } = useTranslation()
  const errorMessage = useErrorMessage()
  if (!sendError) return null
  const { error, beforeStream } = sendError
  if (beforeStream && error instanceof ApiError && error.code === 'validation_error') {
    return t('chat.errors.validation')
  }
  return errorMessage(error)
}

export function ConversationView({ conversationId }: { conversationId: string }) {
  const { t } = useTranslation()
  const messages = useMessages(conversationId)
  const answerMeta = useAnswerMeta()
  const { state, send, stop, dismissSafetyNotice } = useSendMessage(conversationId)
  const [draft, setDraft] = useState('')
  const sendErrorText = useSendErrorText(state.error)

  const scrollRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  const nearBottomRef = useRef(true)
  /** scrollHeight before older messages were prepended, to keep the visible ones in place. */
  const heightBeforeOlderRef = useRef<number | null>(null)

  // Pages are newest first; the screen shows oldest -> newest.
  const items = useMemo(
    () => (messages.data?.pages.flatMap((page) => page.items) ?? []).slice().reverse(),
    [messages.data],
  )
  const generating = state.status !== 'idle'
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = messages

  function loadOlder() {
    if (!hasNextPage || isFetchingNextPage) return
    heightBeforeOlderRef.current = scrollRef.current?.scrollHeight ?? null
    void fetchNextPage()
  }
  const loadOlderRef = useRef(loadOlder)
  useLayoutEffect(() => {
    loadOlderRef.current = loadOlder
  })

  // Scrolling to the top loads older messages (the button below does the same without scrolling).
  useEffect(() => {
    const root = scrollRef.current
    const target = topRef.current
    if (!root || !target || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && root.scrollTop > 0) loadOlderRef.current()
      },
      { root },
    )
    observer.observe(target)
    return () => {
      observer.disconnect()
    }
  }, [messages.isSuccess])

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (heightBeforeOlderRef.current !== null) {
      if (!isFetchingNextPage) {
        el.scrollTop += el.scrollHeight - heightBeforeOlderRef.current
        heightBeforeOlderRef.current = null
      }
      return
    }
    if (nearBottomRef.current) el.scrollTop = el.scrollHeight
  }, [
    items,
    isFetchingNextPage,
    state.answer,
    state.pendingUserText,
    state.status,
    state.safetyNotice,
  ])

  function onScroll() {
    const el = scrollRef.current
    if (!el) return
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX
  }

  async function onSend() {
    const text = draft.trim()
    setDraft('')
    nearBottomRef.current = true
    const accepted = await send(text)
    // Rejected before the stream (busy, blocked, not configured): not saved, give the text back.
    if (!accepted) setDraft((current) => current || text)
  }

  const safetyCard = state.safetyNotice && (
    <SafetyNoticeCard key="safety-notice" onDismiss={dismissSafetyNotice} />
  )
  const safetyBefore = state.safetyNotice?.beforeMessageId ?? null

  if (messages.isPending) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2" role="status">
        <LoaderCircleIcon aria-hidden className="size-6 animate-spin text-muted-foreground" />
        <span className="sr-only">{t('auth.loading')}</span>
        <WakingHint />
      </div>
    )
  }

  if (messages.isError && items.length === 0) {
    const notFound = messages.error instanceof ApiError && messages.error.code === 'not_found'
    return (
      <div className="flex-1">
        {notFound ? (
          <ErrorAlert error={messages.error}>{t('chat.notFound')}</ErrorAlert>
        ) : (
          <ErrorAlert error={messages.error} onRetry={() => void messages.refetch()} />
        )}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
      >
        <div ref={topRef} aria-hidden className="h-px" />
        {hasNextPage && (
          <div className="flex justify-center py-2">
            <Button variant="ghost" size="sm" onClick={loadOlder} disabled={isFetchingNextPage}>
              <RefreshCwIcon aria-hidden className={isFetchingNextPage ? 'animate-spin' : ''} />
              {t('chat.loadOlder')}
            </Button>
          </div>
        )}
        {items.length === 0 && !generating && (
          <p className="py-8 text-center text-muted-foreground">{t('chat.emptyConversation')}</p>
        )}
        <ol aria-label={t('chat.messages')} className="space-y-3 pb-2">
          {items.map((message) => (
            <Fragment key={message.id}>
              {safetyBefore === message.id && safetyCard}
              <MessageBubble
                role={message.role}
                content={message.content}
                meta={answerMeta[message.id]}
              />
            </Fragment>
          ))}
          {state.pendingUserText !== null && (
            <MessageBubble role="user" content={state.pendingUserText} />
          )}
          {safetyBefore === null && safetyCard}
          {state.restarted && (
            <li role="status" className="text-center text-sm text-muted-foreground">
              {t('chat.switchingModel')}
            </li>
          )}
          {state.answer !== '' && <MessageBubble role="assistant" content={state.answer} />}
          {generating && (
            <li role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircleIcon aria-hidden className="size-4 animate-spin" />
              {t('chat.typing')}
            </li>
          )}
        </ol>
      </div>
      {sendErrorText && <ErrorAlert error={state.error?.error}>{sendErrorText}</ErrorAlert>}
      <MessageInput
        value={draft}
        onChange={setDraft}
        onSend={() => void onSend()}
        onStop={stop}
        generating={generating}
      />
    </div>
  )
}
