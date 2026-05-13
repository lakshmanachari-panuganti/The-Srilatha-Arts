/**
 * CSRF Protection — double-submit pattern (§9.1 item 6).
 *
 * - GET /api/auth/csrf  → issues `tsa_csrf=<random>` cookie + JSON { csrfToken }.
 * - Frontend echoes the value in `X-CSRF-Token` header on mutating requests.
 * - `csrfGuard` middleware rejects non-GET requests where header ≠ cookie.
 * - Skipped for webhook routes (signature-verified separately).
 */

import { randomBytes, createHmac } from 'crypto'

const CSRF_SIGNING_KEY = process.env.CSRF_SIGNING_KEY || 'dev-csrf-key-change-me'
const CSRF_COOKIE_NAME = 'tsa_csrf'
const CSRF_TTL_SECONDS = 24 * 60 * 60  // 24 hours

/**
 * Generate a signed CSRF token.
 */
export function generateCsrfToken(): string {
  const nonce = randomBytes(24).toString('hex')
  const expires = Date.now() + CSRF_TTL_SECONDS * 1000
  const payload = `${nonce}.${expires}`
  const sig = createHmac('sha256', CSRF_SIGNING_KEY).update(payload).digest('hex')
  return `${payload}.${sig}`
}

/**
 * Verify a CSRF token is valid and not expired.
 */
export function verifyCsrfToken(token: string): boolean {
  const parts = token.split('.')
  if (parts.length !== 3) return false

  const [nonce, expiresStr, sig] = parts
  const payload = `${nonce}.${expiresStr}`
  const expectedSig = createHmac('sha256', CSRF_SIGNING_KEY).update(payload).digest('hex')

  // Constant-time compare to prevent timing attacks.
  if (sig.length !== expectedSig.length) return false
  let diff = 0
  for (let i = 0; i < sig.length; i++) {
    diff |= sig.charCodeAt(i) ^ expectedSig.charCodeAt(i)
  }
  if (diff !== 0) return false

  const expires = Number(expiresStr)
  return !isNaN(expires) && Date.now() < expires
}

/**
 * Build a Set-Cookie header string for the CSRF cookie.
 */
export function buildCsrfCookie(token: string): string {
  const domain = process.env.COOKIE_DOMAIN ? `; Domain=${process.env.COOKIE_DOMAIN}` : ''
  // NOT HttpOnly — JS needs to read this to echo in X-CSRF-Token header.
  return `${CSRF_COOKIE_NAME}=${token}; Secure; SameSite=Lax; Path=/; Max-Age=${CSRF_TTL_SECONDS}${domain}`
}

/**
 * Extract CSRF token from cookie header.
 */
export function extractCsrfFromCookie(cookieHeader?: string | null): string | null {
  if (!cookieHeader) return null
  const cookies = cookieHeader.split(';').map((c) => c.trim())
  for (const c of cookies) {
    const [name, ...rest] = c.split('=')
    if (name === CSRF_COOKIE_NAME) return decodeURIComponent(rest.join('='))
  }
  return null
}
