/** Backend error body for REST and SSE: {"code": "...", "message": "..."} (hair-chat-api CLAUDE.md). */
export interface ErrorBody {
  code: string
  message: string
}

/** Client-side codes for failures that never reached a backend ErrorBody. */
export const CLIENT_ERROR_CODES = {
  network: 'network_error',
  badResponse: 'bad_response',
  /** No complete answer within the request timeout (client.ts, REQUEST_TIMEOUT_MS). */
  timeout: 'timeout',
} as const

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

function isErrorBody(value: unknown): value is ErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ErrorBody).code === 'string' &&
    typeof (value as ErrorBody).message === 'string'
  )
}

/** Builds an ApiError from a non-2xx response; tolerates non-JSON bodies (proxy errors, HTML). */
export async function errorFromResponse(response: Response): Promise<ApiError> {
  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    // not JSON
  }
  if (isErrorBody(body)) {
    return new ApiError(response.status, body.code, body.message)
  }
  return new ApiError(
    response.status,
    CLIENT_ERROR_CODES.badResponse,
    `HTTP ${response.status} ${response.statusText}`.trim(),
  )
}
