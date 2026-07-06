const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:7071/api'

// Auth tokens injected by the admin/user auth stores at login or on
// rehydration. Two separate slots - customer and admin - because both
// stores persist independently and rehydrate asynchronously on every
// page load. With a single shared slot, whichever store rehydrated
// last would win and the admin DELETE/PATCH requests would 401 because
// the customer token's `role: 'customer'` fails adminGuard.
//
// scope='user' is the default so existing callsites (setApiAuthToken(t))
// keep the previous behaviour.
type AuthScope = 'user' | 'admin'
let _userAuthToken: string | null = null
let _adminAuthToken: string | null = null
export function setApiAuthToken(token: string | null, scope: AuthScope = 'user') {
  if (scope === 'admin') _adminAuthToken = token
  else _userAuthToken = token
}

// Pick which token to attach based on the request path. Anything under
// /admin/* or /auth/admin/* needs the admin JWT; everything else uses
// the customer JWT.
function tokenForPath(path: string): string | null {
  const isAdminCall = path.startsWith('/admin/') || path.startsWith('/auth/admin/')
  return isAdminCall ? _adminAuthToken : _userAuthToken
}

// CSRF - double-submit cookie pattern.
//
// The frontend and the API are on different registrable domains in dev/prd
// (SWA vs Function App), so JS cannot read the `tsa_csrf` cookie even when
// the browser stores it. We fetch the token from the JSON body of
// GET /api/auth/csrf, cache it in memory, and attach it as `X-CSRF-Token`
// on every mutating request. The server compares that header against the
// cookie value the browser is sending alongside the request (the cookie
// must be SameSite=None for the browser to attach it cross-site).
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function readCsrfCookie(): string | null {
  if (typeof document === 'undefined') return null
  const cookies = document.cookie.split(';')
  for (const raw of cookies) {
    const [name, ...rest] = raw.trim().split('=')
    if (name === 'tsa_csrf') {
      try {
        return decodeURIComponent(rest.join('='))
      } catch {
        return rest.join('=')
      }
    }
  }
  return null
}

// Memory cache of the token returned by the most recent /auth/csrf call.
// Cookie storage works in same-origin dev (`localhost`); for the deployed
// cross-origin setup this cache is the only place we can read the token.
let _cachedCsrfToken: string | null = null
let _csrfFetchInFlight: Promise<string | null> | null = null

async function ensureCsrfToken(): Promise<string | null> {
  if (_cachedCsrfToken) return _cachedCsrfToken
  const fromCookie = readCsrfCookie()
  if (fromCookie) {
    _cachedCsrfToken = fromCookie
    return fromCookie
  }
  if (_csrfFetchInFlight) return _csrfFetchInFlight
  _csrfFetchInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' })
      if (!res.ok) return null
      const data = (await res.json()) as { csrfToken?: string }
      const token = data.csrfToken ?? readCsrfCookie()
      _cachedCsrfToken = token
      return token
    } catch {
      return null
    } finally {
      _csrfFetchInFlight = null
    }
  })()
  return _csrfFetchInFlight
}

/**
 * Exposed for non-JSON requests that bypass apiFetch - primarily multipart
 * file uploads, which need to set their own Content-Type boundary and so
 * cannot go through the normal JSON path. Call sites should attach the
 * returned value (if non-null) as `X-CSRF-Token` on their fetch().
 */
export async function getCsrfToken(): Promise<string | null> {
  return ensureCsrfToken()
}

/**
 * Drop the in-memory CSRF cache. Auth stores call this on logout so the
 * next login starts with a fresh token; apiFetch calls it internally when
 * a 403 CSRF error signals the cached token has drifted from the browser
 * cookie (e.g. a second tab re-issued /auth/csrf and overwrote the cookie).
 */
export function clearCsrfToken(): void {
  _cachedCsrfToken = null
  _csrfFetchInFlight = null
}

export function getApiBase(): string {
  return API_BASE
}

export function getAuthToken(scope: AuthScope = 'user'): string | null {
  return scope === 'admin' ? _adminAuthToken : _userAuthToken
}

export interface ApiOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  query?: Record<string, string | number | boolean | undefined | null>
}

export class ApiError extends Error {
  status: number
  body: unknown
  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.status = status
    this.body = body
  }
}

export async function apiFetch<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { body, query, headers, method, ...rest } = opts

  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
    }
  }

  const upperMethod = (method ?? 'GET').toString().toUpperCase()
  const isMutating = MUTATING_METHODS.has(upperMethod)
  const authToken = tokenForPath(path)

  const send = async (): Promise<Response> => {
    const csrfHeader: Record<string, string> = {}
    if (isMutating) {
      const token = await ensureCsrfToken()
      if (token) csrfHeader['X-CSRF-Token'] = token
    }
    return fetch(url.toString(), {
      method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...csrfHeader,
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      ...rest,
    })
  }

  let response = await send()

  // Self-heal on stale CSRF: another tab (or an expired/rotated cookie)
  // can leave the browser's tsa_csrf cookie out of sync with the value
  // we cached in memory. The backend replies 403 with a "CSRF" message;
  // drop the cache, refetch /auth/csrf (which sets a fresh cookie), and
  // retry the request once. Guarded to `isMutating` and a single retry
  // so a genuinely-broken auth never turns into an infinite loop.
  if (isMutating && response.status === 403) {
    const peek = await response.clone().text()
    if (/csrf/i.test(peek)) {
      clearCsrfToken()
      response = await send()
    }
  }

  const text = await response.text()
  const parsed = text ? safeJson(text) : null

  if (!response.ok) {
    const message =
      (parsed && typeof parsed === 'object' && 'error' in parsed
        ? String((parsed as { error: unknown }).error)
        : text) || `Request failed (${response.status})`
    throw new ApiError(message, response.status, parsed)
  }

  return parsed as T
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}
