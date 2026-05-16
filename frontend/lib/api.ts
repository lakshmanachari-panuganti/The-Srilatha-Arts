const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:7071/api'

// Auth token injected by the admin/user auth stores at login.
// Avoids prop-drilling a token into every apiFetch call site.
let _authToken: string | null = null
export function setApiAuthToken(token: string | null) {
  _authToken = token
}

// CSRF: the backend issues a `tsa_csrf` cookie via GET /api/auth/csrf and
// expects the same value back in `X-CSRF-Token` on mutating requests
// (double-submit cookie pattern). The cookie itself is readable by JS
// (not HttpOnly) precisely for this purpose; only same-origin scripts can
// read it, which is what makes the check effective against CSRF.
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

let _csrfFetchInFlight: Promise<string | null> | null = null
async function ensureCsrfToken(): Promise<string | null> {
  const existing = readCsrfCookie()
  if (existing) return existing
  if (_csrfFetchInFlight) return _csrfFetchInFlight
  _csrfFetchInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' })
      if (!res.ok) return null
      const data = (await res.json()) as { csrfToken?: string }
      return data.csrfToken ?? readCsrfCookie()
    } catch {
      return null
    } finally {
      _csrfFetchInFlight = null
    }
  })()
  return _csrfFetchInFlight
}

/**
 * Exposed for non-JSON requests that bypass apiFetch — primarily multipart
 * file uploads, which need to set their own Content-Type boundary and so
 * cannot go through the normal JSON path. Call sites should attach the
 * returned value (if non-null) as `X-CSRF-Token` on their fetch().
 */
export async function getCsrfToken(): Promise<string | null> {
  return ensureCsrfToken()
}

export function getApiBase(): string {
  return API_BASE
}

export function getAuthToken(): string | null {
  return _authToken
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
  const csrfHeader: Record<string, string> = {}
  if (MUTATING_METHODS.has(upperMethod)) {
    const token = await ensureCsrfToken()
    if (token) csrfHeader['X-CSRF-Token'] = token
  }

  const response = await fetch(url.toString(), {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(_authToken ? { Authorization: `Bearer ${_authToken}` } : {}),
      ...csrfHeader,
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    ...rest,
  })

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
