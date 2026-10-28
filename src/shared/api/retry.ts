import { ApiError, CLIENT_ERROR_CODES } from './errors'

/** Attempts per query, the first one included (queryClient.ts). */
export const QUERY_ATTEMPTS = 3

/** Proxy answers while the API machine is down or starting (Fly cold start). */
const GATEWAY_STATUSES = new Set([502, 503, 504])

/**
 * A failure that may pass on its own: no connection, our timeout, or a gateway status.
 * 4xx (and 500) answers will not change on retry.
 */
export function isTransientError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false
  if (error.status === 0) {
    return error.code === CLIENT_ERROR_CODES.network || error.code === CLIENT_ERROR_CODES.timeout
  }
  return GATEWAY_STATUSES.has(error.status)
}

/** A gateway status without our ErrorBody: nginx/Fly answered, not the backend. */
export function isGatewayError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.code === CLIENT_ERROR_CODES.badResponse &&
    GATEWAY_STATUSES.has(error.status)
  )
}

/** TanStack Query `retry`: failureCount is 0 after the first failure. */
export function retryTransient(failureCount: number, error: unknown): boolean {
  return failureCount < QUERY_ATTEMPTS - 1 && isTransientError(error)
}

/** Growing pause before retry n (0-based): 1 s, 2 s, 4 s … at most 8 s. */
export function retryDelayMs(attempt: number, baseMs = 1000): number {
  return Math.min(baseMs * 2 ** attempt, 8 * baseMs)
}
