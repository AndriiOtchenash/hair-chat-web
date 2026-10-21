import { http, HttpResponse } from 'msw'

import { CONSENT_TYPES, CONSENT_VERSION } from '@/consents'
import type {
  ConsentItem,
  ConsentType,
  ConsentsResponse,
  GrantConsentsRequest,
  MeResponse,
  UpdateMeRequest,
} from '@/shared/api/types'

export const API = 'http://localhost/api'

export const meFixture: MeResponse = {
  id: '01929b2e-7c4a-7d3e-9f00-123456789abc',
  role: 'user',
  locale: 'en',
  created_at: '2026-10-01T10:00:00Z',
}

export const GRANTED_AT = '2026-10-15T09:30:00Z'

/**
 * GET /consents body. `granted` = types accepted for `requiredVersion`; `older` = types whose
 * latest active consent is of another version (granted: false, version set).
 */
export function consentsFixture({
  granted = CONSENT_TYPES,
  older = [],
  requiredVersion = CONSENT_VERSION,
}: {
  granted?: readonly ConsentType[]
  older?: readonly ConsentType[]
  requiredVersion?: string
} = {}): ConsentsResponse {
  const items = CONSENT_TYPES.map((type): ConsentItem => {
    if (granted.includes(type)) {
      return { type, granted: true, version: requiredVersion, granted_at: GRANTED_AT }
    }
    if (older.includes(type)) {
      return { type, granted: false, version: '2025-01-v0', granted_at: GRANTED_AT }
    }
    return { type, granted: false, version: null, granted_at: null }
  })
  return { required_version: requiredVersion, items }
}

/** Stateful fake of the consent endpoints, like the backend: POST grants, DELETE revokes. */
export function consentsHandlers(initial = consentsFixture()) {
  let granted = initial.items.filter((i) => i.granted).map((i) => i.type)
  const older = initial.items.filter((i) => !i.granted && i.version).map((i) => i.type)
  const current = () =>
    consentsFixture({
      granted,
      older: older.filter((t) => !granted.includes(t)),
      requiredVersion: initial.required_version,
    })
  return [
    http.get(`${API}/consents`, () => HttpResponse.json(current())),
    http.post(`${API}/consents`, async ({ request }) => {
      const body = (await request.json()) as GrantConsentsRequest
      if (body.version !== initial.required_version) {
        return HttpResponse.json(
          { code: 'consent_version_mismatch', message: 'Consent texts changed' },
          { status: 400 },
        )
      }
      granted = [...new Set([...granted, ...body.types])]
      return HttpResponse.json(current())
    }),
    http.delete(`${API}/consents/:type`, ({ params }) => {
      granted = granted.filter((t) => t !== params.type)
      return new HttpResponse(null, { status: 204 })
    }),
  ]
}

/** Fresh handlers (new consent state) for every test: see setup.ts. */
export const defaultHandlers = () => [
  http.get(`${API}/me`, () => HttpResponse.json(meFixture)),
  http.patch(`${API}/me`, async ({ request }) => {
    const body = (await request.json()) as UpdateMeRequest
    return HttpResponse.json({ ...meFixture, locale: body.locale })
  }),
  ...consentsHandlers(),
]
