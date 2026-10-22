import { ApiError, CLIENT_ERROR_CODES, type ErrorBody } from './errors'

/** One raw server-sent event: `event:` name (default "message") and the joined `data:` lines. */
export interface SSEMessage {
  event: string
  data: string
}

/**
 * Parses a text/event-stream body (WHATWG SSE format). Network chunks can cut an event, a line or
 * even a UTF-8 character anywhere, so text is buffered until a blank line ends the event.
 * Comment lines (`: ping`) are skipped; an unterminated event at the end of the stream is dropped,
 * as the spec says. Aborting `signal` cancels the body (closes the connection).
 */
export async function* readSSE(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<SSEMessage> {
  const reader = body.getReader()
  const cancel = () => {
    void reader.cancel().catch(() => undefined)
  }
  signal?.addEventListener('abort', cancel, { once: true })
  const decoder = new TextDecoder()
  let buffer = ''
  let event = ''
  let data: string[] = []

  function* takeLines(): Generator<SSEMessage> {
    for (;;) {
      const end = buffer.search(/\r\n|\r|\n/)
      // A lone "\r" at the end of the buffer may be the first half of "\r\n": wait for more.
      if (end === -1 || (end === buffer.length - 1 && buffer.endsWith('\r'))) return
      const line = buffer.slice(0, end)
      buffer = buffer.slice(buffer.startsWith('\r\n', end) ? end + 2 : end + 1)

      if (line === '') {
        if (data.length > 0) yield { event: event || 'message', data: data.join('\n') }
        event = ''
        data = []
        continue
      }
      if (line.startsWith(':')) continue
      const colon = line.indexOf(':')
      const field = colon === -1 ? line : line.slice(0, colon)
      let value = colon === -1 ? '' : line.slice(colon + 1)
      if (value.startsWith(' ')) value = value.slice(1)
      if (field === 'event') event = value
      else if (field === 'data') data.push(value)
      // id / retry and unknown fields are not used by our backend.
    }
  }

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      yield* takeLines()
    }
    buffer += decoder.decode()
    if (buffer.endsWith('\r')) buffer += '\n'
    yield* takeLines()
  } finally {
    signal?.removeEventListener('abort', cancel)
    reader.releaseLock()
  }
}

/** A knowledge-base article that was in the context of an answer. */
export interface AnswerSource {
  title: string
  slug: string
  url: string | null
}

export interface DoneData {
  message_id: string
  provider: string
  model: string
  truncated: boolean
  sources: AnswerSource[]
}

/** Chat stream events (SSE contract in hair-chat-api/CLAUDE.md). */
export type ChatStreamEvent =
  | { type: 'safety_notice'; kind: string }
  | { type: 'token'; text: string }
  | { type: 'restart'; reason: string }
  | { type: 'done'; data: DoneData }
  | { type: 'error'; error: ErrorBody }

function badResponse(): ApiError {
  return new ApiError(0, CLIENT_ERROR_CODES.badResponse, 'Malformed stream event')
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) throw badResponse()
  return value as Record<string, unknown>
}

function str(obj: Record<string, unknown>, key: string): string {
  const value = obj[key]
  if (typeof value !== 'string') throw badResponse()
  return value
}

/** Typed chat event, or null for events this client does not know. Throws bad_response. */
export function parseChatEvent(message: SSEMessage): ChatStreamEvent | null {
  const known = ['safety_notice', 'token', 'restart', 'done', 'error']
  if (!known.includes(message.event)) return null
  let json: unknown
  try {
    json = JSON.parse(message.data)
  } catch {
    throw badResponse()
  }
  const obj = record(json)
  switch (message.event) {
    case 'safety_notice':
      return { type: 'safety_notice', kind: str(obj, 'kind') }
    case 'token':
      return { type: 'token', text: str(obj, 'text') }
    case 'restart':
      return { type: 'restart', reason: typeof obj.reason === 'string' ? obj.reason : '' }
    case 'error':
      return { type: 'error', error: { code: str(obj, 'code'), message: str(obj, 'message') } }
    default: {
      const sources = Array.isArray(obj.sources) ? obj.sources : []
      return {
        type: 'done',
        data: {
          message_id: str(obj, 'message_id'),
          provider: typeof obj.provider === 'string' ? obj.provider : '',
          model: typeof obj.model === 'string' ? obj.model : '',
          truncated: obj.truncated === true,
          sources: sources.map((s) => {
            const source = record(s)
            return {
              title: str(source, 'title'),
              slug: str(source, 'slug'),
              url: typeof source.url === 'string' ? source.url : null,
            }
          }),
        },
      }
    }
  }
}
