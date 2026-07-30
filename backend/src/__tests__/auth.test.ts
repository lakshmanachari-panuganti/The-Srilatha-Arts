/**
 * Unit tests for services/auth.ts
 *
 * Covers token generation/verification, cookie building/parsing, and
 * password hashing.  JWT_SECRET is set in jest.setup.ts before this
 * module is loaded.
 *
 * No Azure SDK or network calls are made.
 */

import {
  generateToken,
  verifyToken,
  hashPassword,
  comparePassword,
  extractToken,
  extractTokenFromCookie,
  buildAuthCookie,
  buildClearCookie,
} from '../services/auth'
import type { TokenPayload } from '../types'

// ─── generateToken / verifyToken ─────────────────────────────────────────────

describe('generateToken + verifyToken round-trip', () => {
  const customerPayload: TokenPayload = { id: 'user@example.com', role: 'customer' }
  const adminPayload: TokenPayload = { id: 'admin', role: 'admin' }

  it('signs a customer token and verifies it', () => {
    const token = generateToken(customerPayload)
    const verified = verifyToken(token)
    expect(verified).not.toBeNull()
    expect(verified?.id).toBe('user@example.com')
    expect(verified?.role).toBe('customer')
  })

  it('signs an admin token and verifies it', () => {
    const token = generateToken(adminPayload, true)
    const verified = verifyToken(token)
    expect(verified).not.toBeNull()
    expect(verified?.id).toBe('admin')
    expect(verified?.role).toBe('admin')
  })

  it('signs a superadmin token and verifies it', () => {
    const payload: TokenPayload = { id: 'owner', role: 'superadmin' }
    const token = generateToken(payload, true)
    const verified = verifyToken(token)
    expect(verified?.role).toBe('superadmin')
  })

  it('produces a proper 3-part JWT string', () => {
    const token = generateToken(customerPayload)
    expect(token.split('.')).toHaveLength(3)
  })

  it('produces different tokens for different payloads', () => {
    const t1 = generateToken(customerPayload)
    const t2 = generateToken(adminPayload, true)
    expect(t1).not.toBe(t2)
  })
})

// ─── verifyToken - invalid inputs ─────────────────────────────────────────────

describe('verifyToken - invalid inputs', () => {
  it('returns null for a random string', () => {
    expect(verifyToken('not-a-jwt')).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(verifyToken('')).toBeNull()
  })

  it('returns null for a token signed with a different secret', () => {
    // Decode the header + payload, rebuild signature with wrong key -
    // easiest is to just use a hardcoded forged token structure.
    const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IngiLCJyb2xlIjoiY3VzdG9tZXIiLCJpYXQiOjE3MDAwMDAwMDB9.wrong_signature'
    expect(verifyToken(fakeToken)).toBeNull()
  })

  it('returns null for a structurally valid but tampered payload', () => {
    const token = generateToken({ id: 'real@example.com', role: 'customer' })
    const parts = token.split('.')
    // Replace payload with base64-encoded different content
    const fakePayload = Buffer.from(JSON.stringify({ id: 'hacker@evil.com', role: 'superadmin', iat: 0 })).toString('base64url')
    const tampered = [parts[0], fakePayload, parts[2]].join('.')
    expect(verifyToken(tampered)).toBeNull()
  })
})

// ─── extractToken ─────────────────────────────────────────────────────────────

describe('extractToken', () => {
  it('returns the token from a valid Bearer header', () => {
    expect(extractToken('Bearer mytoken123')).toBe('mytoken123')
  })

  it('handles a JWT with dots in the Bearer value', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.payload.sig'
    expect(extractToken(`Bearer ${jwt}`)).toBe(jwt)
  })

  it('returns null for undefined', () => {
    expect(extractToken(undefined)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(extractToken('')).toBeNull()
  })

  it('returns null for Basic auth scheme', () => {
    expect(extractToken('Basic dXNlcjpwYXNz')).toBeNull()
  })

  it('returns null for "bearer" lowercase (scheme is case-sensitive)', () => {
    expect(extractToken('bearer mytoken')).toBeNull()
  })

  it('returns null when there is no space after Bearer', () => {
    expect(extractToken('Bearer')).toBeNull()
  })
})

// ─── extractTokenFromCookie ───────────────────────────────────────────────────

describe('extractTokenFromCookie', () => {
  it('extracts tsa_token from a single-cookie string', () => {
    const token = 'sometoken'
    expect(extractTokenFromCookie(`tsa_token=${encodeURIComponent(token)}`)).toBe(token)
  })

  it('extracts tsa_token from a multi-cookie string', () => {
    const token = 'abc123'
    const cookie = `session=xyz; tsa_token=${encodeURIComponent(token)}; other=val`
    expect(extractTokenFromCookie(cookie)).toBe(token)
  })

  it('decodes URL-encoded tokens', () => {
    // A JWT naturally contains dots which are not URL-reserved, but the
    // builder uses encodeURIComponent - verify round-trip correctness.
    const jwt = 'header.payload.sig'
    const cookie = `tsa_token=${encodeURIComponent(jwt)}`
    expect(extractTokenFromCookie(cookie)).toBe(jwt)
  })

  it('returns null when cookie header is null', () => {
    expect(extractTokenFromCookie(null)).toBeNull()
  })

  it('returns null when cookie header is undefined', () => {
    expect(extractTokenFromCookie(undefined)).toBeNull()
  })

  it('returns null when tsa_token is absent', () => {
    expect(extractTokenFromCookie('session=abc; other=123')).toBeNull()
  })

  it('returns null for an empty cookie string', () => {
    expect(extractTokenFromCookie('')).toBeNull()
  })
})

// ─── buildAuthCookie ──────────────────────────────────────────────────────────

describe('buildAuthCookie', () => {
  it('starts with tsa_token=', () => {
    expect(buildAuthCookie('tok')).toMatch(/^tsa_token=/)
  })

  it('is HttpOnly', () => {
    expect(buildAuthCookie('tok')).toContain('HttpOnly')
  })

  it('is Secure', () => {
    expect(buildAuthCookie('tok')).toContain('Secure')
  })

  it('is SameSite=None (cross-site cookie for SWA↔Function App auth)', () => {
    // Cookie must travel cross-site because the SPA (Static Web Apps) and
    // the API (Function App) live on different registrable domains. Any
    // regression to Lax breaks the cookie-only auth path introduced by
    // security audit C1 and forces the codebase back onto JWT-in-localStorage.
    expect(buildAuthCookie('tok')).toContain('SameSite=None')
    expect(buildAuthCookie('tok')).not.toContain('SameSite=Lax')
  })

  // These three replace assertions that the cookie carried a persistent
  // Max-Age (24h admin / 7d customer). It deliberately no longer does: the
  // cookie is now a session cookie, so closing the browser ends the session
  // even on a shared or public machine. A persistent cookie survived that,
  // which is the whole reason it was dropped.
  //
  // Asserted as an absence, because the regression to guard against is
  // someone re-adding Max-Age to "fix" users being logged out on browser
  // restart — that would silently undo the change.
  it('emits no Max-Age for customer sessions (session cookie)', () => {
    expect(buildAuthCookie('tok')).not.toContain('Max-Age')
  })

  it('emits no Max-Age for admin sessions either', () => {
    expect(buildAuthCookie('tok', true)).not.toContain('Max-Age')
  })

  it('emits no Expires — persistence must not come back via Expires', () => {
    // Expires is the pre-HTTP/1.1 spelling of the same thing. Blocking only
    // Max-Age would leave the other door open.
    expect(buildAuthCookie('tok')).not.toContain('Expires')
    expect(buildAuthCookie('tok', true)).not.toContain('Expires')
    expect(buildAuthCookie('tok', false)).not.toContain('Expires')
  })

  it('leaves the absolute timeout to the JWT, not the cookie', () => {
    // The cookie no longer bounds the session, so the server-side expiry is
    // the only thing that does. If this drifts, an abandoned tab stays
    // authenticated for as long as the browser stays open.
    const now = Math.floor(Date.now() / 1000)
    const lifetime = (token: string) => {
      const { exp } = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64url').toString(),
      ) as { exp: number }
      return exp - now
    }

    const customer = lifetime(generateToken({ id: 'u@example.com', role: 'customer' }))
    const admin = lifetime(generateToken({ id: 'admin', role: 'admin' }, true))

    expect(customer).toBeGreaterThan(2 * 60 * 60 - 60)
    expect(customer).toBeLessThanOrEqual(2 * 60 * 60)
    expect(admin).toBeGreaterThan(24 * 60 * 60 - 60)
    expect(admin).toBeLessThanOrEqual(24 * 60 * 60)
  })

  it('encodes the token value', () => {
    // Token may contain chars that need URL-encoding.
    const token = 'a+b=c'
    const cookie = buildAuthCookie(token)
    expect(cookie).not.toContain('a+b=c')        // raw should not appear
    expect(cookie).toContain(encodeURIComponent(token))
  })

  // Host-only cookie: Domain= is never emitted, regardless of env. The API
  // and the SPA are on different registrable domains, so any Domain= we set
  // would be rejected by the browser per RFC 6265 §5.3 and the cookie would
  // be silently dropped.
  it('never emits Domain= (host-only cookie)', () => {
    expect(buildAuthCookie('tok')).not.toContain('Domain=')
  })

  it('ignores COOKIE_DOMAIN env var (legacy setting, host-only now)', () => {
    process.env.COOKIE_DOMAIN = 'srilathaarts.com'
    expect(buildAuthCookie('tok')).not.toContain('Domain=')
    delete process.env.COOKIE_DOMAIN
  })
})

// ─── buildClearCookie ─────────────────────────────────────────────────────────

describe('buildClearCookie', () => {
  it('uses cookie name tsa_token', () => {
    expect(buildClearCookie()).toMatch(/^tsa_token=/)
  })

  it('sets Max-Age=0 to expire the cookie immediately', () => {
    expect(buildClearCookie()).toContain('Max-Age=0')
  })

  it('is HttpOnly', () => {
    expect(buildClearCookie()).toContain('HttpOnly')
  })

  it('is Secure', () => {
    expect(buildClearCookie()).toContain('Secure')
  })
})

// ─── hashPassword / comparePassword ───────────────────────────────────────────

describe('hashPassword + comparePassword', () => {
  // bcrypt is intentionally slow - allow 15 s per test
  const TIMEOUT = 15_000

  it('produces a hash that is not equal to the original password', async () => {
    const hash = await hashPassword('secret123')
    expect(hash).not.toBe('secret123')
    expect(hash.length).toBeGreaterThan(20)
  }, TIMEOUT)

  it('comparePassword returns true for the correct password', async () => {
    const hash = await hashPassword('correct-horse-battery-staple')
    expect(await comparePassword('correct-horse-battery-staple', hash)).toBe(true)
  }, TIMEOUT)

  it('comparePassword returns false for a wrong password', async () => {
    const hash = await hashPassword('correct')
    expect(await comparePassword('wrong', hash)).toBe(false)
  }, TIMEOUT)

  it('two calls to hashPassword produce different hashes (salt is random)', async () => {
    const h1 = await hashPassword('samepassword')
    const h2 = await hashPassword('samepassword')
    expect(h1).not.toBe(h2)
  }, TIMEOUT)

  it('the hash produced by one call is still verified correctly', async () => {
    const h1 = await hashPassword('samepassword')
    const h2 = await hashPassword('samepassword')
    expect(await comparePassword('samepassword', h1)).toBe(true)
    expect(await comparePassword('samepassword', h2)).toBe(true)
  }, TIMEOUT)
})
