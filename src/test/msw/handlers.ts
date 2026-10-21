import { http, HttpResponse } from 'msw'

import type { MeResponse } from '@/shared/api/types'

export const API = 'http://localhost/api'

export const meFixture: MeResponse = {
  id: '01929b2e-7c4a-7d3e-9f00-123456789abc',
  role: 'user',
  locale: 'uk',
  created_at: '2026-10-01T10:00:00Z',
}

export const handlers = [http.get(`${API}/me`, () => HttpResponse.json(meFixture))]
