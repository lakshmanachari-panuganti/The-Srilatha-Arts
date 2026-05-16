/**
 * Unit tests for services/csrf.ts
 *
 * Tests CSRF token generation, verification, cookie building, and cookie parsing.
 * CSRF_SIGNING_KEY is set in jest.setup.ts before this module is loaded.
 */

import { createHmac, randomBytes } from 'crypto'
import {
  generateCsrfToken,
  verifyCsrfToken,
  buildCsrfCookie,
  extractCsrfFromCookie,
} from '../services/csrf'

// The test signing key set in jest.setup.ts — must match exactly.
const TEST_KEY = 'test-csrf-signing-key-unit-tests-only!'

// Helper: manually build a signed token with a custom expiry so we can
// test expired-token rejection without mocking Date.
function buildTestToken(expiresMs: number): string {
  const nonce = randomBytes(24).toString('hex')
  const payload = `${nonce}.${expiresMs}`
  const sig = createHmac('sha256', TEST_KEY).update(payload).digest('hex')
  return `${payload}.${sig}`
}

// ─── generateCsrfToken ────────────────────────────────────────────────────────

describe('generateCsrfToken', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateCsrfToken()).toBe('string')
    expect(generateCsrfToken().length).toBeGreaterThan(10)
  })

  it('returns a token with exactly 3 dot-separated parts', () => {
    const parts = generateCsrfToken().split('.')
    expect(parts).toHaveLength(3)
  })

  it('produces unique tokens on each call', () => {
    const tokens = new Set(Array.from({ length: 10 }, () => generateCsrfToken()))
    expect(tokens.size).toBe(10)
  })

  it('nonce part is 48 hex characters (24 random bytes)', () => {
    const [nonce] = generateCsrfToken().split('.')
    expect(/^[0-9a-f]{48}$/.test(nonce)).toBe(true)
  })

  it('expiry part is a future epoch millisecond timestamp', () => {
    const before = Date.now()
    const [, expiresStr] = generateCsrfToken().split('.')
    const expires = Number(expiresStr)
    expect(expires).toBeGreaterThan(before)
  })
})

// ─── verifyCsrfToken ──────────────────────────────────────────────────────────

describe('verifyCsrfToken', () => {
  it('accepts a freshly generated token', () => {
    expect(verifyCsrfToken(generateCsrfToken())).toBe(true)
  })

  it('rejects an empty string', () => {
    expect(verifyCsrfToken('')).toBe(false)
  })

  it('rejects a token with too few parts', () => {
    expect(verifyCsrfToken('onlyone')).toBe(false)
    expect(verifyCsrfToken('two.parts')).toBe(false)
  })

  it('rejects a token with too many parts', () => {
    expect(verifyCsrfToken('a.b.c.d')).toBe(false)
  })

  it('rejects a tampered nonce', () => {
    const token = generateCsrfToken()
    const [, expires, sig] = token.split('.')
    const tampered = `deadbeef.${expires}.${sig}`
    expect(verifyCsrfToken(tampered)).toBe(false)
  })

  it('rejects a tampered expiry', () => {
    const token = generateCsrfToken()
    const [nonce, , sig] = token.split('.')
    const farFuture = String(Date.now() + 999_999_999)
    expect(verifyCsrfToken(`${nonce}.${farFuture}.${sig}`)).toBe(false)
  })

  it('rejects a tampered signature', () => {
    const token = generateCsrfToken()
    const [nonce, expires] = token.split('.')
    expect(verifyCsrfToken(`${nonce}.${expires}.invalidsignaturexxx`)).toBe(false)
  })

  it('rejects an expired token (expiry in the past)', () => {
    const expiredToken = buildTestToken(Date.now() - 1000)
    expect(verifyCsrfToken(expiredToken)).toBe(false)
  })

  it('accepts a token expiring 1 ms in the future', () => {
    // This is technically a race — generous enough for a unit test.
    const token = buildTestToken(Date.now() + 5000)
    expect(verifyCsrfToken(token)).toBe(true)
  })

  it('rejects a token signed with a different key', () => {
    const nonce = randomBytes(24).toString('hex')
    const expires = Date.now() + 86_400_000
    const payload = `${nonce}.${expires}`
    // Sign with a DIFFERENT key than the one in jest.setup.ts.
    const wrongSig = createHmac('sha256', 'wrong-key').update(payload).digest('hex')
    expect(verifyCsrfToken(`${payload}.${wrongSig}`)).toBe(false)
  })
})

// ─── buildCsrfCookie ─────────────────────────────────────────────────────────

describe('buildCsrfCookie', () => {
  it('contains the token value', () => {
    const token = generateCsrfToken()
    expect(buildCsrfCookie(token)).toContain(token)
  })

  it('is NOT HttpOnly (JS must read it to echo in X-CSRF-Token header)', () => {
    const cookie = buildCsrfCookie('tok')
    expect(cookie.toLowerCase()).not.toContain('httponly')
  })

  it('is Secure', () => {
    expect(buildCsrfCookie('tok')).toContain('Secure')
  })

  it('is SameSite=None (required for cross-site mutating fetches)', () => {
    // SwA frontend lives on a different registrable domain than the
    // Functions backend in dev/prd. SameSite=Lax would block the cookie
    // from being attached to POST/PATCH/DELETE — we need None+Secure.
    expect(buildCsrfCookie('tok')).toContain('SameSite=None')
    expect(buildCsrfCookie('tok')).not.toContain('SameSite=Lax')
  })

  it('has a 24-hour Max-Age', () => {
    const expected = 24 * 60 * 60
    expect(buildCsrfCookie('tok')).toContain(`Max-Age=${expected}`)
  })

  it('uses cookie name tsa_csrf', () => {
    expect(buildCsrfCookie('tok')).toMatch(/^tsa_csrf=/)
  })

  it('includes Domain attribute when COOKIE_DOMAIN is set', () => {
    process.env.COOKIE_DOMAIN = 'example.com'
    expect(buildCsrfCookie('tok')).toContain('Domain=example.com')
    delete process.env.COOKIE_DOMAIN
  })

  it('omits Domain attribute when COOKIE_DOMAIN is not set', () => {
    delete process.env.COOKIE_DOMAIN
    expect(buildCsrfCookie('tok')).not.toContain('Domain=')
  })
})

// ─── extractCsrfFromCookie ────────────────────────────────────────────────────

describe('extractCsrfFromCookie', () => {
  it('extracts the tsa_csrf value when present', () => {
    const token = 'abc.def.ghi'
    const cookie = `tsa_csrf=${encodeURIComponent(token)}; other=val`
    expect(extractCsrfFromCookie(cookie)).toBe(token)
  })

  it('works when tsa_csrf is the only cookie', () => {
    expect(extractCsrfFromCookie('tsa_csrf=mytoken')).toBe('mytoken')
  })

  it('works when tsa_csrf is in the middle of multiple cookies', () => {
    const cookie = 'first=a; tsa_csrf=mytok; last=z'
    expect(extractCsrfFromCookie(cookie)).toBe('mytok')
  })

  it('returns null when the cookie header is undefined', () => {
    expect(extractCsrfFromCookie(undefined)).toBeNull()
  })

  it('returns null when the cookie header is null', () => {
    expect(extractCsrfFromCookie(null)).toBeNull()
  })

  it('returns null when tsa_csrf is absent', () => {
    expect(extractCsrfFromCookie('other=value; another=thing')).toBeNull()
  })

  it('returns null for an empty cookie string', () => {
    expect(extractCsrfFromCookie('')).toBeNull()
  })

  it('handles URL-encoded values (e.g. dots encoded as %2E)', () => {
    const raw = 'a.b.c'
    const encoded = encodeURIComponent(raw)
    expect(extractCsrfFromCookie(`tsa_csrf=${encoded}`)).toBe(raw)
  })
})
