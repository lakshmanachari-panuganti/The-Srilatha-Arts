/**
 * Regression test for security audit C2 — CSP must never regress on
 * `script-src 'unsafe-inline'`. Any inline JavaScript that has to run
 * belongs in an external file served from `'self'`; JSON-LD (which
 * modern browsers exempt from script-src because it isn't executable)
 * remains inline.
 *
 * Failure of this test signals that someone added `'unsafe-inline'`
 * back to `script-src` (usually to unblock a new inline snippet).
 * Externalise the snippet instead of loosening the header.
 */

import * as fs from 'fs'
import * as path from 'path'

describe('staticwebapp.config.json — CSP hardening', () => {
  const configPath = path.resolve(__dirname, '..', 'staticwebapp.config.json')
  const raw = fs.readFileSync(configPath, 'utf8')
  const config = JSON.parse(raw) as {
    globalHeaders?: Record<string, string>
  }
  const csp = config.globalHeaders?.['Content-Security-Policy'] ?? ''

  // Extract each directive into a { name: value } map for targeted checks.
  const directives = new Map<string, string>()
  for (const chunk of csp.split(';').map((s) => s.trim()).filter(Boolean)) {
    const [name, ...rest] = chunk.split(/\s+/)
    directives.set(name.toLowerCase(), rest.join(' '))
  }

  it('has a Content-Security-Policy header', () => {
    expect(csp).not.toBe('')
  })

  it("script-src does NOT contain 'unsafe-inline'", () => {
    const scriptSrc = directives.get('script-src') ?? ''
    expect(scriptSrc).not.toMatch(/'unsafe-inline'/)
  })

  it("script-src does NOT contain 'unsafe-eval'", () => {
    const scriptSrc = directives.get('script-src') ?? ''
    expect(scriptSrc).not.toMatch(/'unsafe-eval'/)
  })

  it("keeps 'self' as a script source", () => {
    const scriptSrc = directives.get('script-src') ?? ''
    expect(scriptSrc).toMatch(/'self'/)
  })

  it("keeps frame-ancestors 'none' (defence against clickjacking)", () => {
    expect(directives.get('frame-ancestors')).toBe("'none'")
  })
})
