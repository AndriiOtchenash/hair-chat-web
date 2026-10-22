import { http, HttpResponse } from 'msw'

import { CONSENT_TYPES, CONSENT_VERSION } from '@/consents'
import type {
  AccountExport,
  ConsentItem,
  ConsentType,
  ConsentsResponse,
  DeleteMeRequest,
  GrantConsentsRequest,
  MeResponse,
  UpdateMeRequest,
} from '@/shared/api/types'

import { API } from './api'
import { chatHandlers, createChatFake, type ChatFake } from './chat'

export { API }

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

/** GET /me/export body (backend AccountExport). */
export function exportFixture(overrides: Partial<AccountExport> = {}): AccountExport {
  return {
    format_version: 1,
    exported_at: '2026-10-22T12:00:00Z',
    user: {
      id: meFixture.id,
      auth_sub: 'google-oauth2|123',
      email: null,
      display_name: null,
      locale: 'en',
      role: 'user',
      created_at: meFixture.created_at,
      age_confirmed_at: GRANTED_AT,
    },
    consents: CONSENT_TYPES.map((type) => ({
      type,
      version: CONSENT_VERSION,
      granted_at: GRANTED_AT,
      revoked_at: null,
    })),
    conversations: [
      {
        id: 'c-export-1',
        title: 'Oily scalp',
        summary: null,
        created_at: '2026-10-20T10:00:00Z',
        last_message_at: '2026-10-20T10:01:00Z',
        messages: [
          {
            id: 'm-1',
            role: 'user',
            content: 'How often should I wash oily hair?',
            created_at: '2026-10-20T10:00:00Z',
            provider: null,
            model: null,
            moderation: 'allow',
          },
          {
            id: 'm-2',
            role: 'assistant',
            content: 'Usually **every 1–2 days** with a mild shampoo.',
            created_at: '2026-10-20T10:01:00Z',
            provider: 'gemini',
            model: 'gemini-test',
            moderation: null,
          },
        ],
      },
    ],
    ...overrides,
  }
}

/** The chat fake of the current test (recreated by defaultHandlers before each test). */
export let chatFake: ChatFake = createChatFake()

/** Fresh handlers (new consent and chat state) for every test: see setup.ts. */
export const defaultHandlers = () => {
  chatFake = createChatFake()
  return [
    http.get(`${API}/me`, () => HttpResponse.json(meFixture)),
    http.patch(`${API}/me`, async ({ request }) => {
      const body = (await request.json()) as UpdateMeRequest
      return HttpResponse.json({ ...meFixture, locale: body.locale })
    }),
    http.get(`${API}/me/export`, () =>
      HttpResponse.json(exportFixture(), {
        headers: {
          'Content-Disposition': 'attachment; filename="hair-chat-export-2026-10-22.json"',
        },
      }),
    ),
    http.delete(`${API}/me`, async ({ request }) => {
      const body = (await request.json()) as Partial<DeleteMeRequest> | null
      if (body?.confirm !== 'DELETE') {
        return HttpResponse.json(
          { code: 'validation_error', message: 'body.confirm: invalid' },
          { status: 422 },
        )
      }
      return new HttpResponse(null, { status: 204 })
    }),
    ...consentsHandlers(),
    ...chatHandlers(chatFake),
  ]
}
