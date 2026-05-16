/**
 * CSRF Guard Middleware (§9.1 item 6).
 *
 * Rejects non-GET/OPTIONS/HEAD requests if X-CSRF-Token header
 * doesn't match the tsa_csrf cookie value.
 *
 * Skipped for webhook routes (they use signature verification) and for
 * a small allow-list of routes that bootstrap the CSRF token / session
 * (login, register, google, csrf-fetch, admin-setup).
 */

import { HttpRequest, HttpResponseInit } from '@azure/functions'
import { extractCsrfFromCookie, verifyCsrfToken } from '../services/csrf'
import { errorResponse } from '../utils/response'

const SKIP_PATHS = [
  '/api/razorpay/webhook',
  '/api/courier/webhook',
]

// Routes that must accept POST without a prior CSRF cookie. These either
// bootstrap a session (the cookie is fetched right after) or are protected
// by their own out-of-band mechanism (e.g. setup key, OAuth credential
// nonce + audience check, rate limits).
const BOOTSTRAP_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/google',
  '/api/auth/admin/login',
  '/api/auth/admin/setup',
  '/api/auth/logout',
  '/api/auth/admin/logout',
  '/api/auth/csrf',
]

const EXEMPT_METHODS = ['GET', 'HEAD', 'OPTIONS']

/**
 * Returns null if valid, or an error message string.
 */
export function csrfCheck(request: HttpRequest): string | null {
  if (EXEMPT_METHODS.includes(request.method)) return null

  const url = new URL(request.url)
  if (SKIP_PATHS.some((p) => url.pathname.startsWith(p))) return null
  if (BOOTSTRAP_PATHS.some((p) => url.pathname === p || url.pathname === p + '/')) return null

  const headerToken = request.headers.get('x-csrf-token')
  const cookieToken = extractCsrfFromCookie(request.headers.get('cookie'))

  if (!headerToken || !cookieToken) {
    return 'Missing CSRF token'
  }

  if (headerToken !== cookieToken) {
    return 'CSRF token mismatch'
  }

  if (!verifyCsrfToken(headerToken)) {
    return 'CSRF token expired or invalid'
  }

  return null
}

/**
 * Convenience wrapper for handlers — returns a 403 HttpResponseInit if the
 * request fails the CSRF check, or `null` to indicate the handler should
 * continue. Usage:
 *
 *   const csrfFail = enforceCsrf(request, origin)
 *   if (csrfFail) return csrfFail
 */
export function enforceCsrf(
  request: HttpRequest,
  origin?: string | null,
): HttpResponseInit | null {
  const err = csrfCheck(request)
  if (!err) return null
  return errorResponse(err, 403, origin)
}
