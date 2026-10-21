import { ApiError, CLIENT_ERROR_CODES, errorFromResponse } from './errors'

export interface ApiClientOptions {
  baseUrl: string
  /** Returns an access token for the API audience; throws when the session is gone. */
  getToken: () => Promise<string>
  /** Called once per 401 (or failed token refresh) so the app can log the user out. */
  onUnauthorized: () => void
  /** Called on 403 consent_required (backend rule 7) so the app can show the consent screen. */
  onConsentRequired?: () => void
  fetch?: typeof fetch
}

export interface ApiClient {
  request<T>(path: string, init?: RequestInit): Promise<T>
  get<T>(path: string): Promise<T>
  post<T>(path: string, body: unknown): Promise<T>
  patch<T>(path: string, body: unknown): Promise<T>
  delete(path: string): Promise<void>
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const doFetch = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args))

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let token: string
    try {
      token = await options.getToken()
    } catch {
      options.onUnauthorized()
      throw new ApiError(401, 'not_authenticated', 'Session expired')
    }

    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${token}`)
    headers.set('Accept', 'application/json')
    if (init.body !== undefined && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }

    let response: Response
    try {
      response = await doFetch(`${options.baseUrl}${path}`, { ...init, headers })
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
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
    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  }

  return {
    request,
    get: <T>(path: string) => request<T>(path, { method: 'GET' }),
    post: <T>(path: string, body: unknown) =>
      request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
    patch: <T>(path: string, body: unknown) =>
      request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (path: string) => request<undefined>(path, { method: 'DELETE' }),
  }
}
