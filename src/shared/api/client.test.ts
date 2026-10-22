import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import { API } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'

import { createApiClient } from './client'
import { ApiError } from './errors'

function makeClient(getToken = () => Promise.resolve('tok-123')) {
  const onUnauthorized = vi.fn()
  const client = createApiClient({ baseUrl: API, getToken, onUnauthorized })
  return { client, onUnauthorized }
}

async function catchError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof ApiError) return error
    throw error
  }
  throw new Error('expected the request to fail')
}

describe('createApiClient', () => {
  it('sends the Auth0 access token as Bearer and returns JSON', async () => {
    let authorization: string | null = null
    server.use(
      http.get(`${API}/me`, ({ request }) => {
        authorization = request.headers.get('Authorization')
        return HttpResponse.json({ ok: true })
      }),
    )
    const { client } = makeClient()

    await expect(client.get('/me')).resolves.toEqual({ ok: true })
    expect(authorization).toBe('Bearer tok-123')
  })

  it('parses the backend {code, message} error body', async () => {
    server.use(
      http.get(`${API}/me`, () =>
        HttpResponse.json(
          { code: 'account_deleted', message: 'Account has been deleted' },
          { status: 403 },
        ),
      ),
    )
    const { client, onUnauthorized } = makeClient()

    const error = await catchError(client.get('/me'))
    expect(error).toMatchObject({
      status: 403,
      code: 'account_deleted',
      message: 'Account has been deleted',
    })
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('maps a non-JSON error (e.g. proxy 502) to bad_response', async () => {
    server.use(
      http.get(`${API}/me`, () => new HttpResponse('<html>Bad Gateway</html>', { status: 502 })),
    )
    const { client } = makeClient()

    const error = await catchError(client.get('/me'))
    expect(error).toMatchObject({ status: 502, code: 'bad_response' })
  })

  it('maps a network failure to network_error', async () => {
    server.use(http.get(`${API}/me`, () => HttpResponse.error()))
    const { client } = makeClient()

    const error = await catchError(client.get('/me'))
    expect(error).toMatchObject({ status: 0, code: 'network_error' })
  })

  it('logs out on 401', async () => {
    server.use(
      http.get(`${API}/me`, () =>
        HttpResponse.json({ code: 'invalid_token', message: 'Token expired' }, { status: 401 }),
      ),
    )
    const { client, onUnauthorized } = makeClient()

    const error = await catchError(client.get('/me'))
    expect(error.code).toBe('invalid_token')
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  it('logs out without calling the API when no token can be obtained', async () => {
    const hit = vi.fn()
    server.use(
      http.get(`${API}/me`, () => {
        hit()
        return HttpResponse.json({})
      }),
    )
    const { client, onUnauthorized } = makeClient(() => Promise.reject(new Error('login_required')))

    const error = await catchError(client.get('/me'))
    expect(error).toMatchObject({ status: 401, code: 'not_authenticated' })
    expect(onUnauthorized).toHaveBeenCalledOnce()
    expect(hit).not.toHaveBeenCalled()
  })
})

describe('createApiClient consent_required', () => {
  it('calls onConsentRequired only for 403 consent_required', async () => {
    const onConsentRequired = vi.fn()
    const client = createApiClient({
      baseUrl: API,
      getToken: () => Promise.resolve('tok'),
      onUnauthorized: vi.fn(),
      onConsentRequired,
    })
    server.use(
      http.get(`${API}/conversations`, () =>
        HttpResponse.json({ code: 'consent_required', message: 'x' }, { status: 403 }),
      ),
      http.get(`${API}/me`, () =>
        HttpResponse.json({ code: 'forbidden', message: 'x' }, { status: 403 }),
      ),
    )

    await expect(client.get('/me')).rejects.toMatchObject({ code: 'forbidden' })
    expect(onConsentRequired).not.toHaveBeenCalled()
    await expect(client.get('/conversations')).rejects.toMatchObject({ code: 'consent_required' })
    expect(onConsentRequired).toHaveBeenCalledOnce()
  })

  it('sends JSON bodies for PATCH and treats 204 as empty', async () => {
    let body: unknown = null
    server.use(
      http.patch(`${API}/me`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ ok: true })
      }),
      http.delete(`${API}/consents/age_18`, () => new HttpResponse(null, { status: 204 })),
    )
    const { client } = makeClient()

    await expect(client.patch('/me', { locale: 'pl' })).resolves.toEqual({ ok: true })
    expect(body).toEqual({ locale: 'pl' })
    await expect(client.delete('/consents/age_18')).resolves.toBeUndefined()
  })
})

describe('createApiClient stream', () => {
  const PATH = '/conversations/c1/messages'

  it('POSTs JSON with the token, asks for SSE and returns the open response', async () => {
    let seen: { auth: string | null; accept: string | null; body: unknown } | null = null
    server.use(
      http.post(`${API}${PATH}`, async ({ request }) => {
        seen = {
          auth: request.headers.get('Authorization'),
          accept: request.headers.get('Accept'),
          body: await request.json(),
        }
        return new HttpResponse('event: token\ndata: {"text":"x"}\n\n', {
          headers: { 'Content-Type': 'text/event-stream' },
        })
      }),
    )
    const { client } = makeClient()

    const response = await client.stream(PATH, { content: 'Hi' })
    expect(await response.text()).toContain('event: token')
    expect(seen).toEqual({
      auth: 'Bearer tok-123',
      accept: 'text/event-stream',
      body: { content: 'Hi' },
    })
  })

  it('throws ApiError for errors before the stream (409 conversation_busy)', async () => {
    server.use(
      http.post(`${API}${PATH}`, () =>
        HttpResponse.json({ code: 'conversation_busy', message: 'busy' }, { status: 409 }),
      ),
    )
    const { client } = makeClient()

    const error = await catchError(client.stream(PATH, { content: 'Hi' }))
    expect(error).toMatchObject({ status: 409, code: 'conversation_busy' })
  })

  it('logs out on 401 and rethrows an abort as is', async () => {
    server.use(
      http.post(`${API}${PATH}`, () =>
        HttpResponse.json({ code: 'invalid_token', message: 'x' }, { status: 401 }),
      ),
    )
    const { client, onUnauthorized } = makeClient()
    await catchError(client.stream(PATH, { content: 'Hi' }))
    expect(onUnauthorized).toHaveBeenCalledOnce()

    const controller = new AbortController()
    controller.abort()
    await expect(
      client.stream(PATH, { content: 'Hi' }, controller.signal),
    ).rejects.not.toBeInstanceOf(ApiError)
  })
})
