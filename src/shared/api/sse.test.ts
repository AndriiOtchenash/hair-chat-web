import { describe, expect, it } from 'vitest'

import { ApiError } from './errors'
import { parseChatEvent, readSSE, type SSEMessage } from './sse'

function streamOf(chunks: (string | Uint8Array)[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(typeof chunk === 'string' ? encoder.encode(chunk) : chunk)
      }
      controller.close()
    },
  })
}

async function collect(chunks: (string | Uint8Array)[]): Promise<SSEMessage[]> {
  const out: SSEMessage[] = []
  for await (const message of readSSE(streamOf(chunks))) out.push(message)
  return out
}

describe('readSSE', () => {
  it('reads an event cut at every possible place across chunks', async () => {
    const wire = 'event: token\ndata: {"text":"Hi"}\n\n'
    for (let i = 1; i < wire.length; i++) {
      expect(await collect([wire.slice(0, i), wire.slice(i)])).toEqual([
        { event: 'token', data: '{"text":"Hi"}' },
      ])
    }
  })

  it('reads several events from one chunk', async () => {
    expect(
      await collect([
        'event: token\ndata: {"text":"a"}\n\nevent: token\ndata: {"text":"b"}\n\nevent: done\ndata: {}\n\n',
      ]),
    ).toEqual([
      { event: 'token', data: '{"text":"a"}' },
      { event: 'token', data: '{"text":"b"}' },
      { event: 'done', data: '{}' },
    ])
  })

  it('ignores ping comments, also between and inside events', async () => {
    expect(
      await collect([': ping\n\n', 'event: token\n: ping\ndata: {"text":"x"}\n\n', ': ping\n\n']),
    ).toEqual([{ event: 'token', data: '{"text":"x"}' }])
  })

  it('keeps a UTF-8 character split between chunks', async () => {
    const bytes = new TextEncoder().encode('event: token\ndata: {"text":"Привіт"}\n\n')
    const cut = 'event: token\ndata: {"text":"П'.length + 1 // inside the 2-byte "р"
    const events = await collect([bytes.slice(0, cut), bytes.slice(cut)])
    expect(events).toEqual([{ event: 'token', data: '{"text":"Привіт"}' }])
  })

  it('accepts CRLF and CR line endings, also with CRLF split between chunks', async () => {
    expect(
      await collect(['event: token\r\ndata: 1\r', '\n\r\n', 'event: token\rdata: 2\r\r']),
    ).toEqual([
      { event: 'token', data: '1' },
      { event: 'token', data: '2' },
    ])
  })

  it('joins multi-line data and defaults the event name to "message"', async () => {
    expect(await collect(['data: a\ndata:b\n\n'])).toEqual([{ event: 'message', data: 'a\nb' }])
  })

  it('drops an unterminated event at the end of the stream', async () => {
    expect(await collect(['event: token\ndata: {"text":"a"}\n\nevent: token\ndata: {"te'])).toEqual(
      [{ event: 'token', data: '{"text":"a"}' }],
    )
  })
})

describe('parseChatEvent', () => {
  it('maps the backend events', () => {
    expect(parseChatEvent({ event: 'token', data: '{"text":"Hi"}' })).toEqual({
      type: 'token',
      text: 'Hi',
    })
    expect(parseChatEvent({ event: 'restart', data: '{"reason":"timeout"}' })).toEqual({
      type: 'restart',
      reason: 'timeout',
    })
    expect(parseChatEvent({ event: 'safety_notice', data: '{"kind":"self_harm"}' })).toEqual({
      type: 'safety_notice',
      kind: 'self_harm',
    })
    expect(
      parseChatEvent({ event: 'error', data: '{"code":"llm_unavailable","message":"down"}' }),
    ).toEqual({ type: 'error', error: { code: 'llm_unavailable', message: 'down' } })
    expect(
      parseChatEvent({
        event: 'done',
        data: JSON.stringify({
          message_id: 'm1',
          provider: 'gemini',
          model: 'x',
          truncated: true,
          sources: [{ title: 'Oils', slug: 'oils', url: null }],
        }),
      }),
    ).toEqual({
      type: 'done',
      data: {
        message_id: 'm1',
        provider: 'gemini',
        model: 'x',
        truncated: true,
        sources: [{ title: 'Oils', slug: 'oils', url: null }],
      },
    })
  })

  it('ignores unknown events', () => {
    expect(parseChatEvent({ event: 'message', data: 'hello' })).toBeNull()
  })

  it('turns malformed data into bad_response', () => {
    expect(() => parseChatEvent({ event: 'token', data: 'not json' })).toThrow(ApiError)
    expect(() => parseChatEvent({ event: 'token', data: '{"txt":"a"}' })).toThrow(
      expect.objectContaining({ code: 'bad_response' }),
    )
  })
})
