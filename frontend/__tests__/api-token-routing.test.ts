/**
 * Unit tests for lib/api.ts — token routing.
 *
 * The two-slot design (one customer token, one admin token, both alive at
 * once) exists to fix a real bug: when both stores rehydrate, whichever
 * landed last used to overwrite the other's token, causing 401s on the
 * untouched scope. apiFetch decides which token to attach based on the
 * path prefix. If anything about that prefix logic ever drifts (e.g. a
 * new "public" route accidentally starts with /admin/), this test will
 * catch it.
 */

import { apiFetch, setApiAuthToken } from '../lib/api'

const ORIGINAL_FETCH = global.fetch

beforeEach(() => {
  setApiAuthToken(null, 'user')
  setApiAuthToken(null, 'admin')
})
afterAll(() => {
  global.fetch = ORIGINAL_FETCH
})

// Capture the Headers passed to fetch() for assertion.
function mockFetchCapturing(): jest.Mock {
  const mock = jest.fn(async () => {
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  })
  // ts-jest treats global.fetch as readonly; cast through unknown.
  ;(global as unknown as { fetch: jest.Mock }).fetch = mock
  return mock
}

function authHeader(call: Parameters<typeof fetch>): string | null {
  const init = call[1] as RequestInit | undefined
  if (!init?.headers) return null
  const headers = init.headers as Record<string, string>
  return headers.Authorization ?? headers.authorization ?? null
}

describe('apiFetch — auth token routing', () => {
  it('attaches the customer token on a public path', async () => {
    const fetchMock = mockFetchCapturing()
    setApiAuthToken('USER_TOKEN', 'user')
    setApiAuthToken('ADMIN_TOKEN', 'admin')
    await apiFetch('/my-orders')
    expect(authHeader(fetchMock.mock.calls[0])).toBe('Bearer USER_TOKEN')
  })

  it('attaches the admin token on /admin/* paths', async () => {
    const fetchMock = mockFetchCapturing()
    setApiAuthToken('USER_TOKEN', 'user')
    setApiAuthToken('ADMIN_TOKEN', 'admin')
    await apiFetch('/admin/orders')
    expect(authHeader(fetchMock.mock.calls[0])).toBe('Bearer ADMIN_TOKEN')
  })

  it('attaches the admin token on /auth/admin/* paths', async () => {
    const fetchMock = mockFetchCapturing()
    setApiAuthToken('USER_TOKEN', 'user')
    setApiAuthToken('ADMIN_TOKEN', 'admin')
    await apiFetch('/auth/admin/logout', { method: 'POST' })
    // The first call may be the CSRF preflight to /auth/csrf — find the
    // call to our actual target path.
    const target = fetchMock.mock.calls.find((c) =>
      String(c[0]).includes('/auth/admin/logout'),
    )
    expect(target).toBeDefined()
    expect(authHeader(target!)).toBe('Bearer ADMIN_TOKEN')
  })

  it('does NOT attach the admin token to non-admin paths even if set', async () => {
    const fetchMock = mockFetchCapturing()
    setApiAuthToken(null, 'user')
    setApiAuthToken('ADMIN_TOKEN', 'admin')
    await apiFetch('/products')
    // No user token + non-admin path → no Authorization header at all.
    expect(authHeader(fetchMock.mock.calls[0])).toBeNull()
  })

  it('does NOT attach the user token to admin paths even if set', async () => {
    const fetchMock = mockFetchCapturing()
    setApiAuthToken('USER_TOKEN', 'user')
    setApiAuthToken(null, 'admin')
    await apiFetch('/admin/orders')
    // No admin token + admin path → no Authorization header (preventing
    // accidental customer-token reuse on admin endpoints).
    expect(authHeader(fetchMock.mock.calls[0])).toBeNull()
  })

  it('keeps both tokens alive simultaneously', async () => {
    setApiAuthToken('USER_TOKEN', 'user')
    setApiAuthToken('ADMIN_TOKEN', 'admin')

    const fetchMock = mockFetchCapturing()
    await apiFetch('/my-orders')
    await apiFetch('/admin/orders')

    // Two underlying calls (no CSRF preflight on GETs) — first user, second admin.
    const headers = fetchMock.mock.calls.map(authHeader)
    expect(headers).toContain('Bearer USER_TOKEN')
    expect(headers).toContain('Bearer ADMIN_TOKEN')
  })
})
