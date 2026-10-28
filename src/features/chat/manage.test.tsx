import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'

import { conversation, message } from '@/test/msw/chat'
import { API, chatFake } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render'

const C1 = 'c-1'
const C2 = 'c-2'

function seed() {
  chatFake.conversations = [conversation(C1, 'Oily hair'), conversation(C2, 'Dry ends')]
  chatFake.messages[C1] = [message('m1', 'user', 'How to wash oily hair?')]
  chatFake.messages[C2] = [message('m2', 'user', 'Split ends?')]
}

/** Bodies of the PATCH/DELETE requests to /conversations*, in order. */
function recordManageRequests() {
  const requests: { method: string; path: string; body: Promise<string> }[] = []
  server.events.on('request:start', ({ request }) => {
    const path = new URL(request.url).pathname
    if (['PATCH', 'DELETE'].includes(request.method) && path.includes('/conversations')) {
      requests.push({ method: request.method, path, body: request.clone().text() })
    }
  })
  return requests
}

afterEach(() => {
  server.events.removeAllListeners()
})

/** A response the test releases later, to look at the UI while the request is in flight. */
function deferred() {
  let release!: (response: Response) => void
  const response = new Promise<Response>((resolve) => {
    release = resolve
  })
  return { response, release }
}

async function openList(path = '/chat') {
  seed()
  const user = userEvent.setup()
  const view = renderApp(path)
  await screen.findByRole('link', { name: /^Oily hair/ })
  return { user, ...view }
}

async function chooseAction(
  user: ReturnType<typeof userEvent.setup>,
  title: string,
  action: string,
) {
  await user.click(screen.getByRole('button', { name: `Actions for “${title}”` }))
  await user.click(await screen.findByRole('menuitem', { name: action }))
}

function renameInput() {
  return screen.getByRole('textbox', { name: 'Conversation name' })
}

describe('rename a conversation', () => {
  it('renames inline: Enter saves the trimmed name', async () => {
    const requests = recordManageRequests()
    const { user } = await openList()

    await chooseAction(user, 'Oily hair', 'Rename')
    const input = renameInput()
    expect(input).toHaveValue('Oily hair')
    expect(input).toHaveFocus()
    await user.clear(input)
    await user.type(input, '  Scalp care  {Enter}')

    expect(await screen.findByRole('link', { name: /^Scalp care/ })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Conversation name' })).not.toBeInTheDocument()
    expect(requests).toHaveLength(1)
    expect(requests[0]?.method).toBe('PATCH')
    expect(requests[0]?.path).toBe(`/api/conversations/${C1}`)
    expect(JSON.parse(await (requests[0] as { body: Promise<string> }).body)).toEqual({
      title: 'Scalp care',
    })
    await waitFor(() => {
      expect(chatFake.conversations[0]?.title).toBe('Scalp care')
    })
    expect(screen.getByRole('button', { name: 'Actions for “Scalp care”' })).toHaveFocus()
  })

  it('Escape cancels without a request', async () => {
    const requests = recordManageRequests()
    const { user } = await openList()

    await chooseAction(user, 'Oily hair', 'Rename')
    await user.type(renameInput(), ' and more{Escape}')

    expect(screen.queryByRole('textbox', { name: 'Conversation name' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Oily hair/ })).toBeInTheDocument()
    expect(requests).toHaveLength(0)
  })

  it('does not accept an empty name', async () => {
    const requests = recordManageRequests()
    const { user } = await openList()

    await chooseAction(user, 'Oily hair', 'Rename')
    await user.clear(renameInput())
    await user.type(renameInput(), '   {Enter}')

    expect(await screen.findByRole('alert')).toHaveTextContent('The name cannot be empty.')
    expect(renameInput()).toHaveAttribute('aria-invalid', 'true')
    expect(requests).toHaveLength(0)
  })

  it('shows the new name at once and rolls it back when saving fails', async () => {
    const pending = deferred()
    server.use(http.patch(`${API}/conversations/:id`, () => pending.response))
    const { user } = await openList()

    await chooseAction(user, 'Oily hair', 'Rename')
    await user.clear(renameInput())
    await user.type(renameInput(), 'Scalp care{Enter}')
    expect(await screen.findByRole('link', { name: /^Scalp care/ })).toBeInTheDocument()

    pending.release(HttpResponse.json({ code: 'internal_error', message: 'boom' }, { status: 500 }))

    expect(await screen.findByRole('link', { name: /^Oily hair/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^Scalp care/ })).not.toBeInTheDocument()
    expect(await screen.findByText('Server error. Please try again later.')).toBeInTheDocument()
  })

  it('drops a conversation that is gone (404)', async () => {
    const { user } = await openList()
    chatFake.conversations = chatFake.conversations.filter((c) => c.id !== C1)

    await chooseAction(user, 'Oily hair', 'Rename')
    await user.clear(renameInput())
    await user.type(renameInput(), 'Scalp care{Enter}')

    expect(await screen.findByText('This conversation no longer exists.')).toBeInTheDocument()
    await waitFor(() => {
      expect(
        screen.queryByRole('link', { name: /^(Scalp care|Oily hair)/ }),
      ).not.toBeInTheDocument()
    })
    expect(screen.getByRole('link', { name: /^Dry ends/ })).toBeInTheDocument()
  })

  it('Escape in the narrow-screen panel cancels the rename but keeps the panel open', async () => {
    const { user } = await openList()

    await user.click(screen.getByRole('button', { name: 'Conversations' }))
    const panel = await screen.findByRole('dialog', { name: 'Conversations' })
    await user.click(within(panel).getByRole('button', { name: 'Actions for “Oily hair”' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Rename' }))
    const input = within(panel).getByRole('textbox', { name: 'Conversation name' })
    expect(input).toHaveFocus()
    await user.keyboard('{Escape}')

    expect(within(panel).queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Conversations' })).toBeInTheDocument()
  })
})

describe('delete a conversation', () => {
  it('asks first; Cancel keeps it, Delete removes it', async () => {
    const requests = recordManageRequests()
    const { user } = await openList()

    await chooseAction(user, 'Oily hair', 'Delete')
    let dialog = await screen.findByRole('alertdialog', { name: 'Delete this conversation?' })
    expect(dialog).toHaveTextContent('“Oily hair” and all its messages will be deleted.')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('link', { name: /^Oily hair/ })).toBeInTheDocument()
    expect(requests).toHaveLength(0)

    await chooseAction(user, 'Oily hair', 'Delete')
    dialog = await screen.findByRole('alertdialog', { name: 'Delete this conversation?' })
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(screen.queryByRole('link', { name: /^Oily hair/ })).not.toBeInTheDocument()
    })
    expect(requests.map((r) => `${r.method} ${r.path}`)).toEqual([
      `DELETE /api/conversations/${C1}`,
    ])
    await waitFor(() => {
      expect(chatFake.conversations.map((c) => c.id)).toEqual([C2])
    })
  })

  it('removes it from the list before the server answers', async () => {
    const pending = deferred()
    server.use(http.delete(`${API}/conversations/:id`, () => pending.response))
    const { user } = await openList()

    await chooseAction(user, 'Oily hair', 'Delete')
    await user.click(await screen.findByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(screen.queryByRole('link', { name: /^Oily hair/ })).not.toBeInTheDocument()
    })
    pending.release(new HttpResponse(null, { status: 204 }))
  })

  it('leaves a deleted open conversation for a new chat', async () => {
    const { user, router } = await openList(`/chat/${C1}`)
    await screen.findByText('How to wash oily hair?')

    await chooseAction(user, 'Oily hair', 'Delete')
    await user.click(await screen.findByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/chat')
    })
    expect(await screen.findByText('Choose a conversation or start a new one.')).toBeInTheDocument()
  })

  it('keeps another open conversation open', async () => {
    const { user, router } = await openList(`/chat/${C2}`)
    await screen.findByText('Split ends?')

    await chooseAction(user, 'Oily hair', 'Delete')
    await user.click(await screen.findByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(chatFake.conversations.map((c) => c.id)).toEqual([C2])
    })
    expect(router.state.location.pathname).toBe(`/chat/${C2}`)
  })

  it('409: says the conversation is still answering and puts it back', async () => {
    const { user } = await openList()
    chatFake.busy.add(C1)

    await chooseAction(user, 'Oily hair', 'Delete')
    await user.click(await screen.findByRole('button', { name: 'Delete' }))

    expect(
      await screen.findByText('This conversation is still answering. Please try again later.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Oily hair/ })).toBeInTheDocument()
    expect(chatFake.conversations).toHaveLength(2)
  })

  it('404: the conversation is gone, so it stays out of the list', async () => {
    const { user, router } = await openList(`/chat/${C1}`)
    await screen.findByText('How to wash oily hair?')
    chatFake.conversations = chatFake.conversations.filter((c) => c.id !== C1)

    await chooseAction(user, 'Oily hair', 'Delete')
    await user.click(await screen.findByRole('button', { name: 'Delete' }))

    expect(await screen.findByText('This conversation no longer exists.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^Oily hair/ })).not.toBeInTheDocument()
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/chat')
    })
  })
})

describe('delete all conversations (settings, your data)', () => {
  async function confirmDeleteAll() {
    seed()
    const requests = recordManageRequests()
    const user = userEvent.setup()
    renderApp('/settings')
    await user.click(await screen.findByRole('button', { name: 'Delete all conversations' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete all conversations?' })
    expect(dialog).toHaveTextContent('Your account and consents stay.')
    return { user, dialog, requests }
  }

  it('asks first and sends confirm DELETE_ALL', async () => {
    const { user, dialog, requests } = await confirmDeleteAll()

    await user.click(within(dialog).getByRole('button', { name: 'Delete all' }))

    expect(await screen.findByText('All conversations deleted.')).toBeInTheDocument()
    expect(requests.map((r) => `${r.method} ${r.path}`)).toEqual(['DELETE /api/conversations'])
    expect(JSON.parse(await (requests[0] as { body: Promise<string> }).body)).toEqual({
      confirm: 'DELETE_ALL',
    })
    expect(chatFake.conversations).toHaveLength(0)
  })

  it('Cancel sends nothing', async () => {
    const { user, dialog, requests } = await confirmDeleteAll()

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(requests).toHaveLength(0)
    expect(chatFake.conversations).toHaveLength(2)
  })

  it('409: one is still answering, nothing is deleted', async () => {
    const { user, dialog } = await confirmDeleteAll()
    chatFake.busy.add(C2)

    await user.click(within(dialog).getByRole('button', { name: 'Delete all' }))

    expect(
      await screen.findByText(
        'One of the conversations is still answering. Please try again later.',
      ),
    ).toBeInTheDocument()
    expect(chatFake.conversations).toHaveLength(2)
  })

  it('empties the chat list at once and restores it when deleting fails', async () => {
    seed()
    const pending = deferred()
    server.use(http.delete(`${API}/conversations`, () => pending.response))
    const user = userEvent.setup()
    const { router } = renderApp('/chat')
    await screen.findByRole('link', { name: /^Oily hair/ })

    // The list query stays cached while Settings is open.
    await router.navigate('/settings')
    await user.click(await screen.findByRole('button', { name: 'Delete all conversations' }))
    await user.click(await screen.findByRole('button', { name: 'Delete all' }))
    await router.navigate('/chat')
    expect(await screen.findByText('No conversations yet.')).toBeInTheDocument()

    pending.release(HttpResponse.json({ code: 'internal_error', message: 'boom' }, { status: 500 }))

    expect(await screen.findByRole('link', { name: /^Oily hair/ })).toBeInTheDocument()
    expect(await screen.findByText('Server error. Please try again later.')).toBeInTheDocument()
  })
})
