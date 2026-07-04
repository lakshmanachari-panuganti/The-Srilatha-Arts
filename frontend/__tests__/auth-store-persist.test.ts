/**
 * @jest-environment jsdom
 *
 * Regression tests for security audit C1 — JWTs must NEVER be written to
 * localStorage. Both zustand stores use `persist` with a `partialize` that
 * strips the token before serialisation, so an XSS-obtained handle to
 * localStorage can't lift the session.
 */

// Force a fresh module graph per test so we can observe writes to
// localStorage cleanly without persist middleware caching between cases.
describe('auth stores — persist partialize excludes token', () => {
  beforeEach(() => {
    jest.resetModules()
    window.localStorage.clear()
  })

  it('userAuth store persists user without token', async () => {
    const mod = await import('../stores/userAuth')
    const store = mod.useUserAuth
    // Simulate what a login would set on the in-memory state.
    store.setState({
      user: { email: 'e@x.io', name: 'E', role: 'customer' },
      token: 'SECRET_JWT',
    } as never)

    // Persist middleware writes synchronously on setState.
    const raw = window.localStorage.getItem('tsa-user-auth')
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!) as { state?: Record<string, unknown> }
    expect(parsed.state?.user).toBeDefined()
    expect(parsed.state?.token).toBeUndefined()
    // Belt-and-braces: the serialised blob must not contain the token
    // string anywhere (e.g. persisted under a different key).
    expect(raw).not.toContain('SECRET_JWT')
  })

  it('adminAuth store persists user without token', async () => {
    const mod = await import('../stores/adminAuth')
    const store = mod.useAdminAuth
    store.setState({
      user: { username: 'root', name: 'Root', role: 'superadmin' },
      token: 'ADMIN_SECRET_JWT',
    } as never)

    const raw = window.localStorage.getItem('tsa-admin-auth')
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!) as { state?: Record<string, unknown> }
    expect(parsed.state?.user).toBeDefined()
    expect(parsed.state?.token).toBeUndefined()
    expect(raw).not.toContain('ADMIN_SECRET_JWT')
  })
})
