import { useEffect, useRef, type RefObject } from 'react'
import { useLocation } from 'react-router'

import type { MessageOut } from '@/shared/api/types'

/** Navigation state of a search result: the message to scroll to in the opened conversation. */
export interface FocusMessageState {
  focusMessageId: string
}

/**
 * At most this many pages (PAGE_SIZE each, newest first) are loaded to reach a found message.
 * There is no "page around a message" endpoint, so an old message costs one request per page;
 * past the limit the conversation simply opens at its end.
 */
export const MAX_FOCUS_PAGES = 10

/** How long a found message stays highlighted (= the fade in index.css `search-highlight`). */
export const HIGHLIGHT_MS = 2000

export const MESSAGE_ID_ATTR = 'data-message-id'
/** Set on a found message for HIGHLIGHT_MS; MessageBubble styles it. */
export const HIGHLIGHT_ATTR = 'data-highlighted'

function focusTarget(state: unknown): string | null {
  if (typeof state !== 'object' || state === null || !('focusMessageId' in state)) return null
  const { focusMessageId } = state
  return typeof focusMessageId === 'string' ? focusMessageId : null
}

interface MessagesProgress {
  items: MessageOut[]
  loadedPages: number
  ready: boolean
  failed: boolean
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => unknown
}

/** Marks `el` as highlighted for HIGHLIGHT_MS; returns the cleanup that removes it early. */
function highlight(el: HTMLElement): () => void {
  el.setAttribute(HIGHLIGHT_ATTR, '')
  const timer = setTimeout(() => {
    el.removeAttribute(HIGHLIGHT_ATTR)
  }, HIGHLIGHT_MS)
  return () => {
    clearTimeout(timer)
    el.removeAttribute(HIGHLIGHT_ATTR)
  }
}

/**
 * Brings the message named in the navigation state (a search result) into view: loads older pages
 * until it is there (up to MAX_FOCUS_PAGES), scrolls it to the middle, moves the focus to it and
 * highlights it for a moment. Each navigation (location.key) is handled once.
 */
export function useFocusMessage(
  scrollRef: RefObject<HTMLElement | null>,
  messages: MessagesProgress,
): void {
  const location = useLocation()
  const target = focusTarget(location.state)
  const handledRef = useRef<string | null>(null)
  const clearHighlightRef = useRef<(() => void) | null>(null)
  const { items, loadedPages, ready, failed, hasNextPage, isFetchingNextPage, fetchNextPage } =
    messages

  useEffect(() => {
    if (!target || !ready || handledRef.current === location.key) return
    if (items.some((m) => m.id === target)) {
      handledRef.current = location.key
      const el = Array.from(
        scrollRef.current?.querySelectorAll<HTMLElement>(`[${MESSAGE_ID_ATTR}]`) ?? [],
      ).find((node) => node.getAttribute(MESSAGE_ID_ATTR) === target)
      if (!el) return
      el.scrollIntoView({ block: 'center' })
      el.focus({ preventScroll: true })
      clearHighlightRef.current?.()
      clearHighlightRef.current = highlight(el)
      return
    }
    if (isFetchingNextPage) return
    if (hasNextPage && loadedPages < MAX_FOCUS_PAGES && !failed) {
      void fetchNextPage()
      return
    }
    // Not within reach (or gone): the conversation stays open at its end.
    handledRef.current = location.key
  }, [
    target,
    ready,
    failed,
    items,
    loadedPages,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    location.key,
    scrollRef,
  ])

  useEffect(
    () => () => {
      clearHighlightRef.current?.()
    },
    [],
  )
}
