import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useApiClient } from '@/shared/api/apiClientContext'
import { ApiError, CLIENT_ERROR_CODES } from '@/shared/api/errors'
import { queryKeys } from '@/shared/api/queryKeys'
import { parseChatEvent, readSSE } from '@/shared/api/sse'
import type { SendMessageRequest } from '@/shared/api/types'

import type { AnswerMetaMap } from './api'

export type SendStatus = 'idle' | 'sending' | 'streaming'

export interface SendState {
  status: SendStatus
  /** The user's message while its answer is generated (until the history is refetched). */
  pendingUserText: string | null
  /** The answer so far; never saved by the backend until `done`. */
  answer: string
  /** A provider failed mid-stream and the backup model took over. */
  restarted: boolean
  /** Moderation flagged self-harm: the help card goes right before this answer (null = at the end). */
  safetyNotice: { beforeMessageId: string | null } | null
  /** The last failure; `beforeStream` = the message was not accepted (not saved). */
  error: { error: unknown; beforeStream: boolean } | null
}

const INITIAL: SendState = {
  status: 'idle',
  pendingUserText: null,
  answer: '',
  restarted: false,
  safetyNotice: null,
  error: null,
}

function isAbort(error: unknown, signal: AbortSignal): boolean {
  return signal.aborted || (error instanceof DOMException && error.name === 'AbortError')
}

/**
 * POST /conversations/{id}/messages and reads the SSE answer (fetch + ReadableStream: EventSource
 * cannot send the Authorization header). `send` resolves false when the message was rejected
 * before the stream (409/422/503/network): it was not saved, so the caller gives the text back.
 */
export function useSendMessage(conversationId: string) {
  const api = useApiClient()
  const queryClient = useQueryClient()
  const [state, setState] = useState<SendState>(INITIAL)
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(
    () => () => {
      controllerRef.current?.abort()
    },
    [],
  )

  const refreshHistory = useCallback(async () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.conversations })
    await queryClient.invalidateQueries({ queryKey: queryKeys.messages(conversationId) })
  }, [queryClient, conversationId])

  const send = useCallback(
    async (text: string): Promise<boolean> => {
      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller
      const { signal } = controller
      const update = (patch: Partial<SendState>) => {
        if (!signal.aborted) setState((s) => ({ ...s, ...patch }))
      }
      setState({ ...INITIAL, status: 'sending', pendingUserText: text })

      let response: Response
      try {
        response = await api.stream(
          `/conversations/${conversationId}/messages`,
          { content: text } satisfies SendMessageRequest,
          signal,
        )
      } catch (error) {
        if (isAbort(error, signal)) return true
        update({ ...INITIAL, error: { error, beforeStream: true } })
        return false
      }

      update({ status: 'streaming' })
      let failure: unknown = null
      let doneMessageId: string | null = null
      try {
        if (!response.body) throw new ApiError(0, CLIENT_ERROR_CODES.badResponse, 'No body')
        for await (const message of readSSE(response.body, signal)) {
          if (signal.aborted) break
          const event = parseChatEvent(message)
          if (!event) continue
          if (event.type === 'token') {
            setState((s) => ({ ...s, answer: s.answer + event.text }))
          } else if (event.type === 'restart') {
            update({ answer: '', restarted: true })
          } else if (event.type === 'safety_notice') {
            update({ safetyNotice: { beforeMessageId: null } })
          } else if (event.type === 'error') {
            failure = new ApiError(0, event.error.code, event.error.message)
            break
          } else {
            const { message_id, truncated, sources } = event.data
            doneMessageId = message_id
            queryClient.setQueryData<AnswerMetaMap>(queryKeys.answerMeta, (meta) => ({
              ...meta,
              [message_id]: { truncated, sources },
            }))
            break
          }
        }
        if (!failure && !doneMessageId && !signal.aborted) {
          // The connection ended without done/error.
          failure = new ApiError(0, CLIENT_ERROR_CODES.network, 'Stream ended early')
        }
      } catch (error) {
        if (!isAbort(error, signal)) failure = error
      }
      if (signal.aborted) return true

      // The user's message is saved in every case; a complete answer only on done.
      await refreshHistory()
      update({
        status: 'idle',
        pendingUserText: null,
        answer: '',
        restarted: false,
        error: failure ? { error: failure, beforeStream: false } : null,
      })
      setState((s) =>
        s.safetyNotice ? { ...s, safetyNotice: { beforeMessageId: doneMessageId } } : s,
      )
      if (controllerRef.current === controller) controllerRef.current = null
      return true
    },
    [api, conversationId, queryClient, refreshHistory],
  )

  /** Stop button: cancels the generation; the backend saves no partial answer. */
  const stop = useCallback(() => {
    controllerRef.current?.abort()
    controllerRef.current = null
    setState((s) => ({
      ...s,
      status: 'idle',
      answer: '',
      restarted: false,
      // keep the user's message on screen until the refetch shows the saved one
    }))
    void refreshHistory().then(() => {
      setState((s) => (s.status === 'idle' ? { ...s, pendingUserText: null } : s))
    })
  }, [refreshHistory])

  const dismissSafetyNotice = useCallback(() => {
    setState((s) => ({ ...s, safetyNotice: null }))
  }, [])

  return { state, send, stop, dismissSafetyNotice }
}
