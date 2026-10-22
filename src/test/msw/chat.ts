import { http, HttpResponse } from 'msw'

import type { ConversationOut, MessageOut, SendMessageRequest } from '@/shared/api/types'

import { API } from './api'

/** One SSE event in the backend's wire format. */
export function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export function doneEvent(
  messageId: string,
  extra: {
    truncated?: boolean
    sources?: { title: string; slug: string; url: string | null }[]
  } = {},
): string {
  return sseEvent('done', {
    message_id: messageId,
    provider: 'gemini',
    model: 'gemini-test',
    truncated: extra.truncated ?? false,
    sources: extra.sources ?? [],
  })
}

/**
 * A text/event-stream body the test writes into chunk by chunk (`push`), so it can check the UI
 * between chunks; `close` ends it like the server would.
 */
export function controlledStream() {
  const encoder = new TextEncoder()
  let controller!: ReadableStreamDefaultController<Uint8Array>
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c
    },
  })
  return {
    response: () => new HttpResponse(body, { headers: { 'Content-Type': 'text/event-stream' } }),
    push: (text: string) => {
      controller.enqueue(encoder.encode(text))
    },
    close: () => {
      controller.close()
    },
  }
}

/** A finished stream made of the given chunks (each chunk is a separate network read). */
export function sseResponse(chunks: string[]): HttpResponse<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
      controller.close()
    },
  })
  return new HttpResponse(body, { headers: { 'Content-Type': 'text/event-stream' } })
}

let seq = 0
function nextId(prefix: string): string {
  seq += 1
  return `${prefix}-${String(seq).padStart(4, '0')}`
}

export function conversation(
  id: string,
  title: string | null = `Conversation ${id}`,
): ConversationOut {
  return {
    id,
    title,
    created_at: '2026-10-20T10:00:00Z',
    last_message_at: '2026-10-21T10:00:00Z',
  }
}

export function message(
  id: string,
  role: MessageOut['role'],
  content: string,
  createdAt = '2026-10-21T10:00:00Z',
): MessageOut {
  return {
    id,
    role,
    content,
    provider: role === 'assistant' ? 'gemini' : null,
    model: role === 'assistant' ? 'gemini-test' : null,
    created_at: createdAt,
  }
}

/**
 * Stateful fake of the chat endpoints: cursor pagination like the backend (newest first),
 * POST /conversations, and POST messages that saves the user message and, by default, streams
 * "Hello world" and saves it on done. Tests replace `reply` for other scenarios.
 */
export interface ChatFake {
  conversations: ConversationOut[]
  /** Per conversation, newest first. */
  messages: Record<string, MessageOut[]>
  /** POST /conversations/{id}/messages after validation; returns the HTTP response. */
  reply: (conversationId: string, content: string) => Response
  /** Bodies of every POST to messages, in order. */
  sent: SendMessageRequest[]
  saveUser: (conversationId: string, content: string) => MessageOut
  saveAssistant: (conversationId: string, content: string, id?: string) => MessageOut
}

export function createChatFake(): ChatFake {
  const fake: ChatFake = {
    conversations: [],
    messages: {},
    sent: [],
    saveUser(conversationId, content) {
      const saved = message(nextId('u'), 'user', content)
      fake.messages[conversationId] = [saved, ...(fake.messages[conversationId] ?? [])]
      return saved
    },
    saveAssistant(conversationId, content, id = nextId('a')) {
      const saved = message(id, 'assistant', content)
      fake.messages[conversationId] = [saved, ...(fake.messages[conversationId] ?? [])]
      return saved
    },
    reply(conversationId, content) {
      fake.saveUser(conversationId, content)
      const saved = fake.saveAssistant(conversationId, 'Hello world')
      return sseResponse([
        sseEvent('token', { text: 'Hello' }),
        sseEvent('token', { text: ' world' }),
        doneEvent(saved.id),
      ])
    },
  }
  return fake
}

function page<T>(items: T[], url: URL) {
  const limit = Number(url.searchParams.get('limit') ?? '20')
  const start = Number(url.searchParams.get('cursor') ?? '0')
  const end = start + limit
  return { items: items.slice(start, end), next_cursor: end < items.length ? String(end) : null }
}

export function chatHandlers(fake: ChatFake) {
  return [
    http.get(`${API}/conversations`, ({ request }) =>
      HttpResponse.json(page(fake.conversations, new URL(request.url))),
    ),
    http.post(`${API}/conversations`, () => {
      const created = conversation(nextId('c'), null)
      fake.conversations = [created, ...fake.conversations]
      fake.messages[created.id] = []
      return HttpResponse.json(created, { status: 201 })
    }),
    http.get(`${API}/conversations/:id/messages`, ({ request, params }) => {
      const items = fake.messages[params.id as string]
      if (!items) {
        return HttpResponse.json(
          { code: 'not_found', message: 'Conversation not found' },
          { status: 404 },
        )
      }
      return HttpResponse.json(page(items, new URL(request.url)))
    }),
    http.post(`${API}/conversations/:id/messages`, async ({ request, params }) => {
      const body = (await request.json()) as SendMessageRequest
      fake.sent.push(body)
      return fake.reply(params.id as string, body.content)
    }),
  ]
}
