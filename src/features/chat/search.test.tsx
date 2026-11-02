import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'

import type { MessageOut } from '@/shared/api/types'
import { conversation, message, searchHit } from '@/test/msw/chat'
import { API, chatFake } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render'

import { PAGE_SIZE } from './api'
import { MAX_FOCUS_PAGES } from './useFocusMessage'
import { SEARCH_DEBOUNCE_MS } from './useSearchQuery'

const C1 = 'c-1'
const C2 = 'c-2'

function seed() {
  chatFake.conversations = [conversation(C1, 'Oily hair'), conversation(C2, 'Dry ends')]
  chatFake.messages[C1] = [
    message('m1a', 'assistant', 'Use a mild shampoo.'),
    message('m1', 'user', 'How to wash oily hair?'),
  ]
  chatFake.messages[C2] = [message('m2', 'user', 'What helps with split ends?')]
}

async function openChat(path = '/chat') {
  seed()
  const user = userEvent.setup()
  const view = renderApp(path)
  await screen.findByRole('link', { name: /^Oily hair/ })
  return { user, ...view }
}

function searchBox() {
  return screen.getByRole('searchbox', { name: 'Search conversations' })
}

function results() {
  return screen.getByRole('list', { name: 'Search results' })
}

function pause(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** GET messages requests (page cursors) for a conversation, in order. */
function recordMessagePages(conversationId: string) {
  const cursors: (string | null)[] = []
  server.events.on('request:start', ({ request }) => {
    const url = new URL(request.url)
    if (request.method === 'GET' && url.pathname.endsWith(`/${conversationId}/messages`)) {
      cursors.push(url.searchParams.get('cursor'))
    }
  })
  return cursors
}

afterEach(() => {
  server.events.removeAllListeners()
})

describe('conversation search: typing', () => {
  it('waits for a pause in typing and sends one request for the whole text', async () => {
    const { user } = await openChat()

    await user.type(searchBox(), 'oily')

    expect(await screen.findByRole('list', { name: 'Search results' })).toBeInTheDocument()
    expect(chatFake.searches).toEqual(['oily'])
  })

  it('does not search below two characters and keeps the list', async () => {
    const { user } = await openChat()

    await user.type(searchBox(), ' o ')
    await pause(SEARCH_DEBOUNCE_MS + 100)

    expect(chatFake.searches).toEqual([])
    expect(screen.getByRole('link', { name: /^Oily hair/ })).toBeInTheDocument()
  })

  it('sends the text trimmed', async () => {
    const { user } = await openChat()
    await user.type(searchBox(), '  split  ')
    await screen.findByRole('list', { name: 'Search results' })
    expect(chatFake.searches).toEqual(['split'])
  })

  it('Escape clears the search and shows the list again', async () => {
    const { user } = await openChat()
    await user.type(searchBox(), 'oily')
    await screen.findByRole('list', { name: 'Search results' })

    await user.keyboard('{Escape}')

    expect(searchBox()).toHaveValue('')
    expect(screen.queryByRole('list', { name: 'Search results' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Oily hair/ })).toBeInTheDocument()
  })

  it('the cross clears the search and returns the focus to the box', async () => {
    const { user } = await openChat()
    await user.type(searchBox(), 'oily')
    await screen.findByRole('list', { name: 'Search results' })

    await user.click(screen.getByRole('button', { name: 'Clear search' }))

    expect(searchBox()).toHaveValue('')
    expect(searchBox()).toHaveFocus()
    expect(screen.getByRole('link', { name: /^Dry ends/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument()
  })

  it('aborts the request of outdated text, and its late answer never replaces the new results', async () => {
    let releaseOld!: () => void
    const oldReleased = new Promise<void>((resolve) => {
      releaseOld = resolve
    })
    let oldAborted = false
    server.use(
      http.get(`${API}/conversations/search`, async ({ request }) => {
        if (new URL(request.url).searchParams.get('q') !== 'split') return undefined
        request.signal.addEventListener('abort', () => {
          oldAborted = true
        })
        await oldReleased
        return HttpResponse.json({
          mode: 'semantic',
          items: [searchHit(C1, 'm1', 'Stale answer', 'Stale')],
        })
      }),
    )
    const { user } = await openChat()

    await user.type(searchBox(), 'split')
    expect(await screen.findByRole('status')).toHaveTextContent('Searching…')
    await user.clear(searchBox())
    await user.type(searchBox(), 'oily')

    const list = await screen.findByRole('list', { name: 'Search results' })
    expect(within(list).getByRole('link', { name: /Oily hair/ })).toBeInTheDocument()
    await waitFor(() => {
      expect(oldAborted).toBe(true)
    })

    releaseOld()
    await pause(50)
    expect(screen.queryByText('Stale answer')).not.toBeInTheDocument()
    expect(within(results()).getByRole('link', { name: /Oily hair/ })).toBeInTheDocument()
  })
})

describe('conversation search: results', () => {
  it('shows title, snippet and date of the best match per conversation instead of the list', async () => {
    const { user } = await openChat()

    await user.type(searchBox(), 'hair')

    const list = await screen.findByRole('list', { name: 'Search results' })
    const hit = within(list).getByRole('link')
    expect(hit).toHaveTextContent('Oily hair')
    expect(hit).toHaveTextContent('How to wash oily hair?')
    expect(hit).toHaveTextContent('Oct 21, 2026')
    expect(hit).toHaveAttribute('href', `/chat/${C1}`)
    // The conversation list is gone while the search is on.
    expect(screen.queryByRole('link', { name: /^Dry ends/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/Simplified search/)).not.toBeInTheDocument()
  })

  it('marks results of the simplified (text) search', async () => {
    const { user } = await openChat()
    chatFake.searchMode = 'text'

    await user.type(searchBox(), 'split')

    await screen.findByRole('list', { name: 'Search results' })
    expect(screen.getByText(/Simplified search/)).toBeInTheDocument()
  })

  it('says when nothing is found', async () => {
    const { user } = await openChat()

    await user.type(searchBox(), 'perm')

    expect(await screen.findByText('Nothing found.')).toHaveAttribute('role', 'status')
    expect(screen.queryByRole('list', { name: 'Search results' })).not.toBeInTheDocument()
  })

  it('shows a localized error with a retry', async () => {
    let failing = true
    server.use(
      http.get(`${API}/conversations/search`, () =>
        failing
          ? HttpResponse.json({ code: 'internal_error', message: 'boom' }, { status: 500 })
          : undefined,
      ),
    )
    const { user } = await openChat()

    await user.type(searchBox(), 'oily')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Server error. Please try again later.')
    expect(alert).not.toHaveTextContent('boom')

    failing = false
    await user.click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('list', { name: 'Search results' })).toBeInTheDocument()
  })

  it('in the mobile panel, Escape clears a filled search box and keeps the panel open', async () => {
    const { user } = await openChat()
    await user.click(screen.getByRole('button', { name: 'Conversations' }))
    const panel = await screen.findByRole('dialog', { name: 'Conversations' })
    const box = within(panel).getByRole('searchbox', { name: 'Search conversations' })

    await user.type(box, 'oily')
    await within(panel).findByRole('list', { name: 'Search results' })
    await user.keyboard('{Escape}')

    expect(box).toHaveValue('')
    expect(screen.getByRole('dialog', { name: 'Conversations' })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})

/** `count` messages, newest first (m-<count> … m-1), alternating user/assistant. */
function longHistory(count: number): MessageOut[] {
  return Array.from({ length: count }, (_, i) => {
    const n = count - i
    return message(`m-${String(n)}`, n % 2 ? 'user' : 'assistant', `Message number ${String(n)}`)
  })
}

describe('conversation search: opening a result', () => {
  it('opens the conversation and focuses the found message', async () => {
    const { user, router } = await openChat()
    await user.type(searchBox(), 'split')

    await user.click(
      within(await screen.findByRole('list', { name: 'Search results' })).getByRole('link'),
    )

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/chat/${C2}`)
    })
    const found = await within(await screen.findByRole('list', { name: 'Messages' })).findByText(
      'What helps with split ends?',
    )
    await waitFor(() => {
      expect(found.closest('li')).toHaveFocus()
    })
  })

  it('loads older pages until the found message is there', async () => {
    seed()
    // The target is on the 2nd page (pages are newest first).
    const history = longHistory(PAGE_SIZE + 10)
    history[PAGE_SIZE + 5] = message('target', 'user', 'Is henna safe for hair?')
    chatFake.messages[C1] = history
    const pages = recordMessagePages(C1)
    const user = userEvent.setup()
    const { router } = renderApp(`/chat/${C2}`)
    await screen.findByText('What helps with split ends?')

    await user.type(searchBox(), 'henna')
    await user.click(
      within(await screen.findByRole('list', { name: 'Search results' })).getByRole('link'),
    )

    const found = await within(await screen.findByRole('list', { name: 'Messages' })).findByText(
      'Is henna safe for hair?',
    )
    await waitFor(() => {
      expect(found.closest('li')).toHaveFocus()
    })
    expect(router.state.location.pathname).toBe(`/chat/${C1}`)
    expect(pages).toEqual([null, String(PAGE_SIZE)])
  })

  it(`gives up after ${String(MAX_FOCUS_PAGES)} pages and just opens the conversation`, async () => {
    seed()
    chatFake.messages[C1] = longHistory(PAGE_SIZE * (MAX_FOCUS_PAGES + 2))
    server.use(
      http.get(`${API}/conversations/search`, () =>
        HttpResponse.json({
          mode: 'semantic',
          items: [searchHit(C1, 'very-old', 'An ancient question', 'Oily hair')],
        }),
      ),
    )
    const pages = recordMessagePages(C1)
    const user = userEvent.setup()
    renderApp('/chat')
    await screen.findByRole('link', { name: /^Oily hair/ })

    await user.type(searchBox(), 'ancient')
    await user.click(
      within(await screen.findByRole('list', { name: 'Search results' })).getByRole('link'),
    )

    await waitFor(() => {
      expect(pages).toHaveLength(MAX_FOCUS_PAGES)
    })
    await pause(50)
    expect(pages).toHaveLength(MAX_FOCUS_PAGES)
    // Open at its newest message; the target was never reached.
    expect(
      screen.getByText(`Message number ${String(PAGE_SIZE * (MAX_FOCUS_PAGES + 2))}`),
    ).toBeInTheDocument()
  })
})
