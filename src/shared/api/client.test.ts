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
