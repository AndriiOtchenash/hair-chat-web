import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import i18n, { rememberExplicitLanguage, type Language } from '@/i18n'
import {
  controlledStream,
  conversation,
  doneEvent,
  message,
  sseEvent,
  sseResponse,
} from '@/test/msw/chat'
import { API, chatFake } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render'

const C1 = 'c-1'

/** One conversation with a short history (newest first, like the API). */
function seedConversation(
  messages = [
    message('m2', 'assistant', 'Use a mild shampoo.'),
    message('m1', 'user', 'How to wash oily hair?'),
  ],
) {
  chatFake.conversations = [conversation(C1, 'Oily hair')]
  chatFake.messages[C1] = messages
}

function input() {
  return screen.getByRole('textbox', { name: 'Message' })
}

/** An explicit choice, so LocaleSync does not switch the UI to the profile's locale. */
async function pickLanguage(lng: Language) {
  rememberExplicitLanguage(lng)
  await i18n.changeLanguage(lng)
}

async function openConversation() {
  seedConversation()
  const user = userEvent.setup()
  const view = renderApp(`/chat/${C1}`)
  await screen.findByText('Use a mild shampoo.')
  return { user, ...view }
}

function messageList() {
  return screen.getByRole('list', { name: 'Messages' })
}

describe('conversation list', () => {
  it('shows conversations and loads more by cursor', async () => {
    chatFake.conversations = Array.from({ length: 25 }, (_, i) =>
      conversation(`c-${String(i + 1)}`, `Topic ${String(i + 1)}`),
    )
    const user = userEvent.setup()
    renderApp('/chat')

    expect(await screen.findByRole('link', { name: /^Topic 1(?!\d)/ })).toHaveAttribute(
      'href',
      '/chat/c-1',
    )
    expect(screen.getByRole('link', { name: /^Topic 20/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^Topic 21/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Show more' }))

    expect(await screen.findByRole('link', { name: /^Topic 25/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument()
  })

  it('shows an untitled conversation as "New conversation"', async () => {
    chatFake.conversations = [conversation(C1, null)]
    renderApp('/chat')
    expect(await screen.findByRole('link', { name: /New conversation/ })).toBeInTheDocument()
  })

  it('creates a conversation and opens it', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/chat')

    const buttons = await screen.findAllByRole('button', { name: 'New conversation' })
    await user.click(buttons[0] as HTMLElement)

    await waitFor(() => {
      expect(router.state.location.pathname).toMatch(/^\/chat\/c-\d+$/)
    })
    expect(await screen.findByText('Ask your first question about hair care.')).toBeInTheDocument()
    expect(chatFake.conversations).toHaveLength(1)
  })

  it('opens the list in a side panel on narrow screens and closes it after a choice', async () => {
    seedConversation()
    const user = userEvent.setup()
    const { router } = renderApp('/chat')

    await user.click(await screen.findByRole('button', { name: 'Conversations' }))
    const panel = await screen.findByRole('dialog', { name: 'Conversations' })
    await user.click(await within(panel).findByRole('link', { name: /Oily hair/ }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(router.state.location.pathname).toBe(`/chat/${C1}`)
  })

  it('keeps the AI disclosure visible on every chat screen', async () => {
    seedConversation()
    const user = userEvent.setup()
    renderApp('/chat')
    expect(await screen.findByRole('note')).toHaveTextContent(
      'You are chatting with an AI assistant',
    )

    await user.click(await screen.findByRole('link', { name: /Oily hair/ }))
    await screen.findByText('Use a mild shampoo.')
    expect(screen.getByRole('note')).toHaveTextContent('You are chatting with an AI assistant')
  })
})

describe('messages', () => {
  it('shows the history oldest first and loads older messages by cursor', async () => {
    chatFake.conversations = [conversation(C1)]
    chatFake.messages[C1] = Array.from({ length: 25 }, (_, i) =>
      message(`m${String(25 - i)}`, i % 2 ? 'user' : 'assistant', `Message ${String(25 - i)}`),
    )
    const user = userEvent.setup()
    renderApp(`/chat/${C1}`)

    await screen.findByText('Message 25')
    const texts = () =>
      within(messageList())
        .getAllByRole('listitem')
        .map((li) => li.textContent.replace(/^(You|Assistant): /, ''))
    expect(texts()[0]).toBe('Message 6')
    expect(texts().at(-1)).toBe('Message 25')
    expect(screen.queryByText('Message 5')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Load older messages' }))

    expect(await screen.findByText('Message 1')).toBeInTheDocument()
    expect(texts()[0]).toBe('Message 1')
    expect(screen.queryByRole('button', { name: 'Load older messages' })).not.toBeInTheDocument()
  })

  it('renders answers as markdown without raw HTML and with safe links', async () => {
    seedConversation([
      message(
        'm1',
        'assistant',
        '**Bold tip**\n\n<script>alert(1)</script><b>raw</b>\n\n[site](https://example.com) [bad](javascript:alert(1))',
      ),
    ])
    renderApp(`/chat/${C1}`)

    expect(await screen.findByText('Bold tip')).toHaveProperty('tagName', 'STRONG')
    expect(document.querySelector('script')).toBeNull()
    expect(screen.queryByText('raw')).not.toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'site' })
    expect(link).toHaveAttribute('href', 'https://example.com')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
    const bad = screen.getByText('bad')
    expect(bad.closest('a')?.getAttribute('href') ?? '').not.toMatch(/javascript/i)
  })

  it('renders GFM tables, strikethrough and autolinks with the same safety rules', async () => {
    seedConversation([
      message(
        'm1',
        'assistant',
        [
          '| Hair type | Wash |',
          '| --- | --- |',
          '| Oily | Every day |',
          '| Dry <b>raw</b> | ~~Daily~~ Twice a week |',
          '',
          'See www.example.com and https://kb.example/oils',
          '',
          '![pixel](https://tracker.example/p.png)',
        ].join('\n'),
      ),
    ])
    renderApp(`/chat/${C1}`)

    const table = await screen.findByRole('table')
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((th) => th.textContent),
    ).toEqual(['Hair type', 'Wash'])
    const rows = within(table).getAllByRole('row')
    expect(rows).toHaveLength(3)
    expect(
      within(rows[1] as HTMLElement)
        .getAllByRole('cell')
        .map((td) => td.textContent),
    ).toEqual(['Oily', 'Every day'])
    // Raw HTML inside a cell is still dropped.
    expect(within(table).queryByText('raw')).not.toBeInTheDocument()
    expect(table.querySelector('b')).toBeNull()

    expect(screen.getByText('Daily')).toHaveProperty('tagName', 'DEL')

    for (const [name, href] of [
      ['www.example.com', 'http://www.example.com'],
      ['https://kb.example/oils', 'https://kb.example/oils'],
    ] as const) {
      const link = screen.getByRole('link', { name })
      expect(link).toHaveAttribute('href', href)
      expect(link).toHaveAttribute('target', '_blank')
      expect(link.getAttribute('rel')).toContain('noopener')
    }
    expect(document.querySelector('img')).toBeNull()
  })

  it('says when the conversation does not exist', async () => {
    renderApp('/chat/missing')
    expect(
      await screen.findByText('This conversation was not found. It may have been deleted.'),
    ).toBeInTheDocument()
  })
})

describe('sending a message', () => {
  it('streams tokens, blocks the input meanwhile, then shows the saved answer', async () => {
    const stream = controlledStream()
    chatFake.reply = (id, content) => {
      chatFake.saveUser(id, content)
      return stream.response()
    }
    const { user } = await openConversation()

    await user.type(input(), 'Is coconut oil good?')
    expect(screen.getByText('20 / 4000')).toBeInTheDocument()
    await user.keyboard('{Enter}')

    expect(await screen.findByText('Is coconut oil good?')).toBeInTheDocument()
    expect(input()).toBeDisabled()
    expect(input()).toHaveValue('')
    expect(screen.getByRole('status')).toHaveTextContent('The assistant is typing…')

    stream.push(sseEvent('token', { text: 'It can ' }))
    expect(await screen.findByText('It can')).toBeInTheDocument()
    // An event cut in the middle of a chunk.
    stream.push('event: token\ndata: {"te')
    stream.push('xt":"help."}\n\n: ping\n\n')
    expect(await screen.findByText('It can help.')).toBeInTheDocument()

    const saved = chatFake.saveAssistant(C1, 'It can help.')
    stream.push(
      doneEvent(saved.id, {
        sources: [
          { title: 'Oils for hair', slug: 'oils', url: 'https://kb.example/oils' },
          { title: 'Scalp care', slug: 'scalp', url: null },
        ],
      }),
    )
    stream.close()

    await waitFor(() => {
      expect(input()).toBeEnabled()
    })
    expect(screen.queryByText('The assistant is typing…')).not.toBeInTheDocument()
    expect(screen.getByText('Sources')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Oils for hair' })).toHaveAttribute(
      'href',
      'https://kb.example/oils',
    )
    expect(screen.getByText('Scalp care').closest('a')).toBeNull()
    expect(
      screen.queryByText('The answer was cut short. Ask to continue if you need more.'),
    ).not.toBeInTheDocument()
    expect(screen.getAllByText('It can help.')).toHaveLength(1)
    expect(chatFake.sent).toEqual([{ content: 'Is coconut oil good?' }])
  })

  it('marks a truncated answer', async () => {
    chatFake.reply = (id, content) => {
      chatFake.saveUser(id, content)
      const saved = chatFake.saveAssistant(id, 'A long answer')
      return sseResponse([
        sseEvent('token', { text: 'A long answer' }),
        doneEvent(saved.id, { truncated: true }),
      ])
    }
    const { user } = await openConversation()

    await user.type(input(), 'Tell me everything{Enter}')

    expect(
      await screen.findByText('The answer was cut short. Ask to continue if you need more.'),
    ).toBeInTheDocument()
  })

  it('clears the partial answer on restart and says it switches to the backup model', async () => {
    const stream = controlledStream()
    chatFake.reply = () => stream.response()
    const { user } = await openConversation()

    await user.type(input(), 'Hi{Enter}')
    stream.push(sseEvent('token', { text: 'Half an ans' }))
    expect(await screen.findByText('Half an ans')).toBeInTheDocument()

    stream.push(sseEvent('restart', { reason: 'provider failed' }))
    expect(
      await screen.findByText('Switching to the backup model, the answer starts again…'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Half an ans')).not.toBeInTheDocument()

    stream.push(sseEvent('token', { text: 'Fresh answer' }))
    expect(await screen.findByText('Fresh answer')).toBeInTheDocument()
    stream.close()
  })

  it('shows a localized error event and keeps the saved user message', async () => {
    chatFake.reply = (id, content) => {
      chatFake.saveUser(id, content)
      return sseResponse([
        sseEvent('token', { text: 'Part' }),
        sseEvent('error', { code: 'llm_unavailable', message: 'All providers down' }),
      ])
    }
    const { user } = await openConversation()

    await user.type(input(), 'Hello{Enter}')

    expect(
      await screen.findByText(
        'The assistant is temporarily unavailable. Your message is saved; please try again in a few minutes.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText('All providers down')).not.toBeInTheDocument()
    expect(screen.queryByText('Part')).not.toBeInTheDocument()
    expect(within(messageList()).getByText('Hello')).toBeInTheDocument()
    expect(input()).toBeEnabled()
    expect(input()).toHaveValue('')
  })

  it('treats a stream that ends without done as a network error', async () => {
    chatFake.reply = () => sseResponse([sseEvent('token', { text: 'Cut' })])
    const { user } = await openConversation()

    await user.type(input(), 'Hello{Enter}')

    expect(
      await screen.findByText('Cannot reach the server. Check your connection.'),
    ).toBeInTheDocument()
  })

  it.each([
    [
      409,
      'conversation_busy',
      'An answer is still being written in this conversation. Wait for it to finish and try again.',
    ],
    [
      422,
      'message_blocked',
      'This message was not sent because it breaks the usage rules. Please rephrase it.',
    ],
    [422, 'validation_error', 'The message must be from 1 to 4000 characters long.'],
    [
      503,
      'llm_not_configured',
      'The assistant is not available right now. Please try again later.',
    ],
  ])('shows %i %s before the stream and gives the text back', async (status, code, text) => {
    chatFake.reply = () => HttpResponse.json({ code, message: 'server text' }, { status })
    const { user } = await openConversation()

    await user.type(input(), 'My question{Enter}')

    expect(await screen.findByText(text)).toBeInTheDocument()
    expect(screen.queryByText('server text')).not.toBeInTheDocument()
    expect(input()).toHaveValue('My question')
    expect(input()).toBeEnabled()
    expect(within(messageList()).queryByText('My question')).not.toBeInTheDocument()
  })

  it('shows errors in the UI language', async () => {
    await pickLanguage('pl')
    chatFake.reply = () =>
      HttpResponse.json({ code: 'conversation_busy', message: 'busy' }, { status: 409 })
    seedConversation()
    const user = userEvent.setup()
    renderApp(`/chat/${C1}`)
    await screen.findByText('Use a mild shampoo.')

    await user.type(screen.getByRole('textbox', { name: 'Wiadomość' }), 'Pytanie{Enter}')

    expect(
      await screen.findByText(
        'W tej rozmowie wciąż powstaje odpowiedź. Poczekaj, aż się zakończy, i spróbuj ponownie.',
      ),
    ).toBeInTheDocument()
  })

  it('Stop cancels the generation and removes the partial answer', async () => {
    const stream = controlledStream()
    chatFake.reply = (id, content) => {
      chatFake.saveUser(id, content)
      return stream.response()
    }
    const { user } = await openConversation()

    await user.type(input(), 'Hello{Enter}')
    stream.push(sseEvent('token', { text: 'Partial answer' }))
    expect(await screen.findByText('Partial answer')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Stop' }))

    expect(screen.queryByText('Partial answer')).not.toBeInTheDocument()
    expect(input()).toBeEnabled()
    expect(screen.queryByText('The assistant is typing…')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Stop' })).not.toBeInTheDocument()
    // The backend keeps the user's message; the refetched history shows it.
    expect(await within(messageList()).findByText('Hello')).toBeInTheDocument()
    // Whatever the server would still send is not shown.
    try {
      stream.push(sseEvent('token', { text: ' and more' }))
    } catch {
      // the body was cancelled
    }
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(screen.queryByText(/and more/)).not.toBeInTheDocument()
  })

  it('Shift+Enter adds a new line, Enter on blank text sends nothing', async () => {
    const { user } = await openConversation()

    await user.type(input(), '   {Enter}')
    expect(chatFake.sent).toHaveLength(0)
    await user.clear(input())

    await user.type(input(), 'Line 1{Shift>}{Enter}{/Shift}Line 2')
    expect(input()).toHaveValue('Line 1\nLine 2')
    expect(chatFake.sent).toHaveLength(0)

    await user.keyboard('{Enter}')
    await waitFor(() => {
      expect(chatFake.sent).toEqual([{ content: 'Line 1\nLine 2' }])
    })
  })

  it('limits the message to 4000 characters', async () => {
    const { user } = await openConversation()

    await user.click(input())
    await user.paste('a'.repeat(4100))

    expect(input()).toHaveValue('a'.repeat(4000))
    expect(screen.getByText('4000 / 4000')).toBeInTheDocument()
  })
})

describe('safety notice', () => {
  const TITLES: Record<Language, string> = {
    en: 'You are not alone',
    pl: 'Nie jesteś sam(a)',
    uk: 'Ви не самі',
    ru: 'Вы не одни',
  }

  function replyWithSafetyNotice() {
    chatFake.reply = (id, content) => {
      chatFake.saveUser(id, content)
      const saved = chatFake.saveAssistant(id, 'I am sorry you feel this way.')
      return sseResponse([
        sseEvent('safety_notice', { kind: 'self_harm' }),
        sseEvent('token', { text: 'I am sorry you feel this way.' }),
        doneEvent(saved.id),
      ])
    }
  }

  async function sendAndFindCard(lng: Language, label: string) {
    await pickLanguage(lng)
    replyWithSafetyNotice()
    seedConversation()
    const user = userEvent.setup()
    renderApp(`/chat/${C1}`)
    await screen.findByText('Use a mild shampoo.')
    await user.type(screen.getByRole('textbox', { name: label }), 'text{Enter}')
    const card = await screen.findByRole('region', { name: TITLES[lng] })
    return { user, card }
  }

  it('shows the help card before the answer with international contacts, and can be closed', async () => {
    const { user, card } = await sendAndFindCard('en', 'Message')

    expect(within(card).getByRole('heading', { name: 'You are not alone' })).toBeInTheDocument()
    expect(within(card).getByRole('link', { name: '112' })).toHaveAttribute('href', 'tel:112')
    expect(within(card).getByRole('link', { name: 'findahelpline.com' })).toHaveAttribute(
      'href',
      'https://findahelpline.com',
    )
    expect(within(card).queryByRole('link', { name: '116 123' })).not.toBeInTheDocument()
    expect(within(card).queryByRole('link', { name: '7333' })).not.toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Message' })).toBeEnabled()
    })
    const answer = screen.getByText('I am sorry you feel this way.')
    // After done the card stays right before the answer it belongs to.
    const savedCard = screen.getByRole('region', { name: 'You are not alone' })
    expect(savedCard.compareDocumentPosition(answer)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)

    await user.click(within(savedCard).getByRole('button', { name: 'Close the help card' }))
    expect(screen.queryByRole('region', { name: 'You are not alone' })).not.toBeInTheDocument()
  })

  it('adds 116 123 for Polish', async () => {
    const { card } = await sendAndFindCard('pl', 'Wiadomość')
    expect(within(card).getByRole('link', { name: '116 123' })).toHaveAttribute(
      'href',
      'tel:116123',
    )
    expect(within(card).getByRole('link', { name: '112' })).toBeInTheDocument()
  })

  it('adds Lifeline Ukraine 7333 for Ukrainian', async () => {
    const { card } = await sendAndFindCard('uk', 'Повідомлення')
    expect(within(card).getByRole('link', { name: '7333' })).toHaveAttribute('href', 'tel:7333')
    expect(within(card).getByRole('link', { name: 'findahelpline.com' })).toBeInTheDocument()
  })
})

describe('consents', () => {
  it('sends the user to /consents when the chat answers consent_required', async () => {
    seedConversation()
    server.use(
      http.get(`${API}/conversations/:id/messages`, () =>
        HttpResponse.json({ code: 'consent_required', message: 'x' }, { status: 403 }),
      ),
    )
    const { router } = renderApp(`/chat/${C1}`)
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/consents')
    })
  })
})
