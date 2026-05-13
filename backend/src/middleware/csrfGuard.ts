/**
 * CSRF Guard Middleware (§9.1 item 6).
 *
 * Rejects non-GET/OPTIONS/HEAD requests if X-CSRF-Token header
 * doesn't match the tsa_csrf cookie value.
 *
 * Skipped for webhook routes (they use signature verification).
 */

import { HttpRequest } from '@azure/functions'
import { extractCsrfFromCookie, verifyCsrfToken } from '../services/csrf'

const SKIP_PATHS = [
  '/api/payments/webhook',
  '/api/courier/webhook',
]

const EXEMPT_METHODS = ['GET', 'HEAD', 'OPTIONS']

/**
 * Returns null if valid, or an error message string.
 */
export function csrfCheck(request: HttpRequest): string | null {
  if (EXEMPT_METHODS.includes(request.method)) return null

  const url = new URL(request.url)
  if (SKIP_PATHS.some((p) => url.pathname.startsWith(p))) return null

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
