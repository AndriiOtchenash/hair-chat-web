import { ApiError, CLIENT_ERROR_CODES, errorFromResponse } from './errors'

export interface ApiClientOptions {
  baseUrl: string
  /** Returns an access token for the API audience; throws when the session is gone. */
  getToken: () => Promise<string>
  /** Called once per 401 (or failed token refresh) so the app can log the user out. */
  onUnauthorized: () => void
  /** Called on 403 consent_required (backend rule 7) so the app can show the consent screen. */
  onConsentRequired?: () => void
  /** Whole-request limit for everything but `stream()`; default REQUEST_TIMEOUT_MS. */
  timeoutMs?: number
  fetch?: typeof fetch
}

/**
 * A cold API machine on Fly can keep a request hanging for minutes (nginx waits up to 300 s for
 * SSE), so ordinary calls give up after 20 s with ApiError `timeout`; queries then retry it.
 */
export const REQUEST_TIMEOUT_MS = 20_000

export interface ApiClient {
  request<T>(path: string, init?: RequestInit): Promise<T>
  get<T>(path: string): Promise<T>
  post<T>(path: string, body: unknown): Promise<T>
  patch<T>(path: string, body: unknown): Promise<T>
  /** DELETE, optionally with a JSON body (DELETE /me {confirm}). */
  delete(path: string, body?: unknown): Promise<void>
  /** GET a file (attachment): the body as a Blob and the name from Content-Disposition, if any. */
  download(path: string): Promise<{ blob: Blob; filename: string | null }>
  /**
   * The session is over (account deleted, signing out): every later call is rejected without
   * reaching the network. Our backend creates a user on first sight of a valid token, so a single
   * request after DELETE /me would bring the account back.
   */
  endSession(): void
  /**
   * POST that answers with a stream (SSE): resolves with the 2xx Response once headers arrive;
   * errors before the stream (4xx/5xx) are thrown as ApiError like any other call.
   */
  stream(path: string, body: unknown, signal?: AbortSignal): Promise<Response>
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const doFetch = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args))
  let ended = false

  async function send(path: string, init: RequestInit, accept: string): Promise<Response> {
    if (ended) throw new ApiError(401, 'not_authenticated', 'Session ended')
    let token: string
    try {
      token = await options.getToken()
    } catch {
      options.onUnauthorized()
      throw new ApiError(401, 'not_authenticated', 'Session expired')
    }

    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${token}`)
    headers.set('Accept', accept)
    if (init.body !== undefined && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }

    let response: Response
    try {
      response = await doFetch(`${options.baseUrl}${path}`, { ...init, headers })
    } catch (cause) {
      if (init.signal?.aborted || (cause instanceof DOMException && cause.name === 'AbortError')) {
        throw cause
      }
      throw new ApiError(0, CLIENT_ERROR_CODES.network, 'Network request failed')
    }

    if (!response.ok) {
      const error = await errorFromResponse(response)
      if (response.status === 401) options.onUnauthorized()
      if (response.status === 403 && error.code === 'consent_required') {
        options.onConsentRequired?.()
      }
      throw error
    }
    return response
  }

  /** Runs `call` (fetch and body read) under the request timeout; a timeout is ApiError `timeout`. */
  async function timed<T>(init: RequestInit, call: (init: RequestInit) => Promise<T>): Promise<T> {
    const timeout = new AbortController()
    const timer = setTimeout(() => {
      timeout.abort()
    }, options.timeoutMs ?? REQUEST_TIMEOUT_MS)
    const signal = init.signal ? AbortSignal.any([init.signal, timeout.signal]) : timeout.signal
    try {
      return await call({ ...init, signal })
    } catch (cause) {
      if (timeout.signal.aborted && !init.signal?.aborted) {
        throw new ApiError(0, CLIENT_ERROR_CODES.timeout, 'Request timed out')
      }
      throw cause
    } finally {
      clearTimeout(timer)
    }
  }

  function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    return timed(init, async (init) => {
      const response = await send(path, init, 'application/json')
      if (response.status === 204) return undefined as T
      return (await response.json()) as T
    })
  }

  return {
    request,
    get: <T>(path: string) => request<T>(path, { method: 'GET' }),
    post: <T>(path: string, body: unknown) =>
      request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
    patch: <T>(path: string, body: unknown) =>
      request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (path: string, body?: unknown) =>
      request<undefined>(path, {
        method: 'DELETE',
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    download: (path: string) =>
      timed({ method: 'GET' }, async (init) => {
        const response = await send(path, init, '*/*')
        return {
          blob: await response.blob(),
          filename: filenameFromDisposition(response.headers.get('Content-Disposition')),
        }
      }),
    endSession: () => {
      ended = true
    },
    // No timeout: an answer may stream for minutes (the backend pings every 15 s).
    stream: (path: string, body: unknown, signal?: AbortSignal) =>
      send(path, { method: 'POST', body: JSON.stringify(body), signal }, 'text/event-stream'),
  }
}

/**
 * File name from a Content-Disposition header: RFC 5987 `filename*=UTF-8''…` wins over
 * `filename="…"`. Path parts are dropped so a name can never point outside the download folder.
 */
export function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null
  let name: string | null = null
  const extended = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/.exec(header)
  if (extended?.[1]) {
    try {
      name = decodeURIComponent(extended[1].trim())
    } catch {
      name = null
    }
  }
  if (!name) {
    const plain = /filename\s*=\s*(?:"([^"]*)"|([^;]+))/.exec(header)
    name = (plain?.[1] ?? plain?.[2])?.trim() ?? null
  }
  const base = name?.split(/[\\/]/).pop()?.trim()
  return base ? base : null
}
