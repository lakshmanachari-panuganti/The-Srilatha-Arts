/**
 * Unit tests for utils/clientIp.
 *
 * Covers the security-critical IP-extraction precedence used by rate
 * limiting on auth endpoints. Getting this wrong lets attackers bypass
 * the rate limiter by spoofing x-forwarded-for.
 */

import { HttpRequest } from '@azure/functions'
import { getClientIp } from '../utils/clientIp'

function makeRequest(headers: Record<string, string>): HttpRequest {
  // Minimal stub: only `headers.get(name)` is touched by getClientIp.
  // We return a fresh Headers instance so case-insensitive lookup matches
  // Azure's real implementation.
  const h = new Headers(headers)
  return { headers: h } as unknown as HttpRequest
}

describe('getClientIp', () => {
  it('prefers x-azure-clientip over everything else', () => {
    const req = makeRequest({
      'x-azure-clientip': '203.0.113.42',
      'x-forwarded-for': '1.1.1.1, 2.2.2.2',
      'x-real-ip': '9.9.9.9',
    })
    expect(getClientIp(req)).toBe('203.0.113.42')
  })

  it('trims surrounding whitespace from x-azure-clientip', () => {
    const req = makeRequest({ 'x-azure-clientip': '  203.0.113.42  ' })
    expect(getClientIp(req)).toBe('203.0.113.42')
  })

  it('returns the rightmost x-forwarded-for entry (Azure-appended)', () => {
    const req = makeRequest({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 3.3.3.3' })
    expect(getClientIp(req)).toBe('3.3.3.3')
  })

  it('rejects a leftmost-IP spoof attempt (uses rightmost, not leftmost)', () => {
    // Attacker prepends arbitrary IP; Azure proxy appends real IP on the right.
    const req = makeRequest({ 'x-forwarded-for': '6.6.6.6, 203.0.113.42' })
    expect(getClientIp(req)).toBe('203.0.113.42')
    expect(getClientIp(req)).not.toBe('6.6.6.6')
  })

  it('trims whitespace from XFF entries', () => {
    const req = makeRequest({ 'x-forwarded-for': '1.1.1.1,   2.2.2.2  ' })
    expect(getClientIp(req)).toBe('2.2.2.2')
  })

  it('ignores empty XFF entries from trailing commas', () => {
    const req = makeRequest({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2, ,' })
    expect(getClientIp(req)).toBe('2.2.2.2')
  })

  it('returns the single XFF entry when only one is present', () => {
    const req = makeRequest({ 'x-forwarded-for': '203.0.113.42' })
    expect(getClientIp(req)).toBe('203.0.113.42')
  })

  it('falls back to x-real-ip when neither x-azure-clientip nor XFF is set', () => {
    const req = makeRequest({ 'x-real-ip': '203.0.113.42' })
    expect(getClientIp(req)).toBe('203.0.113.42')
  })

  it('prefers XFF rightmost over x-real-ip', () => {
    const req = makeRequest({
      'x-forwarded-for': '1.1.1.1, 203.0.113.42',
      'x-real-ip': '9.9.9.9',
    })
    expect(getClientIp(req)).toBe('203.0.113.42')
  })

  it('returns "unknown" when no IP-bearing header is present', () => {
    const req = makeRequest({})
    expect(getClientIp(req)).toBe('unknown')
  })

  it('returns "unknown" when XFF is empty string', () => {
    const req = makeRequest({ 'x-forwarded-for': '' })
    expect(getClientIp(req)).toBe('unknown')
  })

  it('returns "unknown" when XFF is only whitespace and commas', () => {
    const req = makeRequest({ 'x-forwarded-for': ' , , ' })
    expect(getClientIp(req)).toBe('unknown')
  })
})
