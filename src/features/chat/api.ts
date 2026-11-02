import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query'

import { useApiClient } from '@/shared/api/apiClientContext'
import { ApiError } from '@/shared/api/errors'
import { queryKeys } from '@/shared/api/queryKeys'
import type { AnswerSource } from '@/shared/api/sse'
import type {
  ConversationOut,
  ConversationsPage,
  DeleteAllRequest,
  MessagesPage,
  RenameRequest,
  SearchResults,
} from '@/shared/api/types'

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

/** Backend RenameRequest: 1–120 characters after trimming. */
export const MAX_TITLE_CHARS = 120

type ConversationsData = InfiniteData<ConversationsPage, string | null>

export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'not_found'
}

type ConversationsUpdate = (data: ConversationsData) => ConversationsData

/** An update of the cached list that changes the items of every loaded page. */
function mapItems(update: (items: ConversationOut[]) => ConversationOut[]): ConversationsUpdate {
  return (data) => ({
    ...data,
    pages: data.pages.map((page) => ({ ...page, items: update(page.items) })),
  })
}

function updateConversations(queryClient: QueryClient, update: ConversationsUpdate): void {
  queryClient.setQueryData<ConversationsData>(
    queryKeys.conversations,
    (data) => data && update(data),
  )
}

/**
 * Optimistic edit of the cached list: stops refetches that would overwrite it and returns the
 * previous list for a rollback.
 */
async function editConversations(
  queryClient: QueryClient,
  update: ConversationsUpdate,
): Promise<{ previous: ConversationsData | undefined }> {
  await queryClient.cancelQueries({ queryKey: queryKeys.conversations })
  const previous = queryClient.getQueryData<ConversationsData>(queryKeys.conversations)
  updateConversations(queryClient, update)
  return { previous }
}

/** The conversation is gone on the server (deleted here, elsewhere, or 404): drop it everywhere. */
function forgetConversation(queryClient: QueryClient, id: string): void {
  updateConversations(
    queryClient,
    mapItems((items) => items.filter((c) => c.id !== id)),
  )
  queryClient.removeQueries({ queryKey: queryKeys.messages(id) })
  queryClient.removeQueries({ queryKey: queryKeys.conversationSearch() })
}

/**
 * Callbacks of a conversation mutation. They are set on the hook, not on `mutate()`, so they
 * still run when the screen that started it is gone (optimistic removal, a closed panel, another
 * page).
 */
export interface ManageCallbacks {
  onSuccess?: (id: string) => void
  onError?: (error: unknown, id: string) => void
}

/** PATCH /conversations/{id} {title}: shown at once, rolled back on error; 404 drops it. */
export function useRenameConversation({ onSuccess, onError }: ManageCallbacks = {}) {
  const api = useApiClient()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      api.patch<ConversationOut>(`/conversations/${id}`, { title } satisfies RenameRequest),
    onMutate: ({ id, title }) =>
      editConversations(
        queryClient,
        mapItems((items) => items.map((c) => (c.id === id ? { ...c, title } : c))),
      ),
    onSuccess: (saved) => {
      updateConversations(
        queryClient,
        mapItems((items) => items.map((c) => (c.id === saved.id ? saved : c))),
      )
      onSuccess?.(saved.id)
    },
    onError: (error, { id }, context) => {
      if (isNotFound(error)) forgetConversation(queryClient, id)
      else queryClient.setQueryData(queryKeys.conversations, context?.previous)
      onError?.(error, id)
    },
  })
}

/** DELETE /conversations/{id}: removed from the list at once, back on error (but 404 = gone). */
export function useDeleteConversation({ onSuccess, onError }: ManageCallbacks = {}) {
  const api = useApiClient()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/conversations/${id}`),
    onMutate: (id) =>
      editConversations(
        queryClient,
        mapItems((items) => items.filter((c) => c.id !== id)),
      ),
    onSuccess: (_, id) => {
      forgetConversation(queryClient, id)
      onSuccess?.(id)
    },
    onError: (error, id, context) => {
      if (isNotFound(error)) forgetConversation(queryClient, id)
      else queryClient.setQueryData(queryKeys.conversations, context?.previous)
      onError?.(error, id)
    },
  })
}

/**
 * DELETE /conversations {confirm: "DELETE_ALL"}: the list empties at once and comes back on
 * error (409 = one is still answering, the backend then deletes none).
 */
export function useDeleteAllConversations({
  onSuccess,
  onError,
}: { onSuccess?: () => void; onError?: (error: unknown) => void } = {}) {
  const api = useApiClient()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      api.delete('/conversations', { confirm: 'DELETE_ALL' } satisfies DeleteAllRequest),
    onMutate: () =>
      editConversations(queryClient, () => ({
        pages: [{ items: [], next_cursor: null }],
        pageParams: [null],
      })),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['messages'] })
      queryClient.removeQueries({ queryKey: queryKeys.conversationSearch() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations })
      onSuccess?.()
    },
    onError: (error, _, context) => {
      queryClient.setQueryData(queryKeys.conversations, context?.previous)
      onError?.(error)
    },
  })
}

/** Backend search: q is 2..500 characters after trimming (else 422), limit 1..20. */
export const MIN_SEARCH_CHARS = 2
export const MAX_SEARCH_CHARS = 500
const SEARCH_LIMIT = 20

/**
 * GET /conversations/search for a trimmed query (disabled below MIN_SEARCH_CHARS). Each query has
 * its own cache entry, and the request gets the query's AbortSignal: when the query text changes,
 * the old query loses its last observer and TanStack Query aborts its request, so a late answer
 * can neither cost a slot on the server nor replace the results of the new text.
 */
export function useConversationSearch(q: string) {
  const api = useApiClient()
  return useQuery({
    queryKey: queryKeys.conversationSearch(q),
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ q, limit: String(SEARCH_LIMIT) })
      return api.request<SearchResults>(`/conversations/search?${params.toString()}`, {
        method: 'GET',
        signal,
      })
    },
    enabled: q.length >= MIN_SEARCH_CHARS,
    // No cache: the backend indexes a new answer in the background ~0.5 s after the stream ends,
    // so invalidating on `done` would come too early and a cached result would hide the answer.
    // Every search (also the same text again) asks the server.
    staleTime: 0,
    gcTime: 0,
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
