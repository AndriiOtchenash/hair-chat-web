import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useApiClient } from '@/shared/api/apiClientContext'
import { queryKeys } from '@/shared/api/queryKeys'
import type { AnswerSource } from '@/shared/api/sse'
import type { ConversationOut, ConversationsPage, MessagesPage } from '@/shared/api/types'

export const PAGE_SIZE = 20
/** Backend SendMessageRequest: 1–4000 characters after trimming. */
export const MAX_MESSAGE_CHARS = 4000

function pagePath(path: string, cursor: string | null): string {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE) })
  if (cursor) params.set('cursor', cursor)
  return `${path}?${params.toString()}`
}

/** GET /conversations, most recent first; fetchNextPage follows next_cursor. */
export function useConversations() {
  const api = useApiClient()
  return useInfiniteQuery({
    queryKey: queryKeys.conversations,
    queryFn: ({ pageParam }) => api.get<ConversationsPage>(pagePath('/conversations', pageParam)),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
  })
}

export function useCreateConversation() {
  const api = useApiClient()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<ConversationOut>('/conversations', {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.conversations }),
  })
}

/** GET /conversations/{id}/messages: pages are newest first; fetchNextPage loads older ones. */
export function useMessages(conversationId: string) {
  const api = useApiClient()
  return useInfiniteQuery({
    queryKey: queryKeys.messages(conversationId),
    queryFn: ({ pageParam }) =>
      api.get<MessagesPage>(pagePath(`/conversations/${conversationId}/messages`, pageParam)),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
  })
}

/** What only the stream tells about an answer; kept in memory for this session. */
export interface AnswerMeta {
  truncated: boolean
  sources: AnswerSource[]
}

export type AnswerMetaMap = Record<string, AnswerMeta>

export function useAnswerMeta(): AnswerMetaMap {
  const { data } = useQuery<AnswerMetaMap>({
    queryKey: queryKeys.answerMeta,
    queryFn: () => ({}),
    initialData: {},
    staleTime: Infinity,
    gcTime: Infinity,
  })
  return data
}
