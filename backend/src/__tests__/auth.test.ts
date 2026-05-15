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

// ─── verifyToken — invalid inputs ─────────────────────────────────────────────

describe('verifyToken — invalid inputs', () => {
  it('returns null for a random string', () => {
    expect(verifyToken('not-a-jwt')).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(verifyToken('')).toBeNull()
  })

  it('returns null for a token signed with a different secret', () => {
    // Decode the header + payload, rebuild signature with wrong key —
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
    // builder uses encodeURIComponent — verify round-trip correctness.
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

  it('is SameSite=Lax', () => {
    expect(buildAuthCookie('tok')).toContain('SameSite=Lax')
  })

  it('uses 24-hour Max-Age for admin sessions', () => {
    const cookie = buildAuthCookie('tok', true)
    expect(cookie).toContain(`Max-Age=${24 * 60 * 60}`)
  })

  it('uses 7-day Max-Age for customer sessions (default)', () => {
    const cookie = buildAuthCookie('tok')
    expect(cookie).toContain(`Max-Age=${7 * 24 * 60 * 60}`)
  })

  it('uses 7-day Max-Age when isAdmin is explicitly false', () => {
    const cookie = buildAuthCookie('tok', false)
    expect(cookie).toContain(`Max-Age=${7 * 24 * 60 * 60}`)
  })

  it('encodes the token value', () => {
    // Token may contain chars that need URL-encoding.
    const token = 'a+b=c'
    const cookie = buildAuthCookie(token)
    expect(cookie).not.toContain('a+b=c')        // raw should not appear
    expect(cookie).toContain(encodeURIComponent(token))
  })

  it('includes Domain when COOKIE_DOMAIN is set', () => {
    process.env.COOKIE_DOMAIN = 'srilathaarts.com'
    expect(buildAuthCookie('tok')).toContain('Domain=srilathaarts.com')
    delete process.env.COOKIE_DOMAIN
  })

  it('omits Domain when COOKIE_DOMAIN is not set', () => {
    delete process.env.COOKIE_DOMAIN
    expect(buildAuthCookie('tok')).not.toContain('Domain=')
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
  // bcrypt is intentionally slow — allow 15 s per test
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
