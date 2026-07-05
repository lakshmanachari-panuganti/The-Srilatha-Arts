/**
 * Regression test for CSP shape.
 *
 * Note on 'unsafe-inline' in script-src: Next.js App Router static export
 * emits inline <script>self.__next_f.push(...)</script> blocks for the RSC
 * payload used to hydrate the tree. Nonces would require per-request SSR
 * (SWA Free tier + `output: 'export'` cannot inject one at build time), and
 * hashing every push is unmaintainable because the payloads change each build.
 * We therefore accept 'unsafe-inline' on script-src as a documented residual
 * until the app moves to SSR with per-request nonces. `'unsafe-eval'` is
 * still forbidden.
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
