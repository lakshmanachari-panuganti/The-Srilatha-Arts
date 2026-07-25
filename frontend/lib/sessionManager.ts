// Session timing stored in localStorage so it survives page reloads
// and is shared across tabs (same browser session). The session cookie
// (no Max-Age) handles browser-close invalidation independently; this
// module only tracks the 2-hour absolute limit from the moment of login.
const SESSION_START_KEY = 'tsa_session_start'
const SESSION_DURATION_MS = 2 * 60 * 60 * 1000 // 2 hours, matches JWT expiresIn

export function recordSessionStart(): void {
  try {
    localStorage.setItem(SESSION_START_KEY, String(Date.now()))
  } catch {}
}

export function clearSessionRecord(): void {
  try {
    localStorage.removeItem(SESSION_START_KEY)
  } catch {}
}

export function getSessionRemainingMs(): number {
  try {
    const raw = localStorage.getItem(SESSION_START_KEY)
    if (!raw) return 0
    const elapsed = Date.now() - Number(raw)
    return Math.max(0, SESSION_DURATION_MS - elapsed)
  } catch {
    return 0
  }
}

export function isSessionExpired(): boolean {
  return getSessionRemainingMs() === 0
}
