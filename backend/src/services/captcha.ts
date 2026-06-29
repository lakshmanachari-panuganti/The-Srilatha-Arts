/**
 * CAPTCHA verification — Google reCAPTCHA v3.
 *
 * Env-gated so PRD enforces and DEV does not:
 *   CAPTCHA_ENABLED            = 'true' to enforce; anything else is off
 *   RECAPTCHA_SECRET           = server secret from the reCAPTCHA admin console
 *   RECAPTCHA_SCORE_THRESHOLD  = optional, default 0.5 (v3 returns 0.0–1.0)
 *   RECAPTCHA_VERIFY_URL       = optional override, defaults to Google's endpoint
 *
 * Callers pass the token the SPA obtained from grecaptcha.execute(siteKey,
 * { action }) plus the same `action` string they expect; verification fails
 * if the action returned by Google does not match (prevents replaying a
 * token captured from a different page).
 */

const VERIFY_URL =
  process.env.RECAPTCHA_VERIFY_URL ||
  'https://www.google.com/recaptcha/api/siteverify'

function isEnabled(): boolean {
  return (process.env.CAPTCHA_ENABLED || '').toLowerCase() === 'true'
}

function scoreThreshold(): number {
  const raw = process.env.RECAPTCHA_SCORE_THRESHOLD
  if (!raw) return 0.5
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : 0.5
}

export interface CaptchaResult {
  ok: boolean
  /** Human-readable reason for failure (logged, not necessarily returned to the user). */
  reason?: string
  /** reCAPTCHA v3 score, when available. */
  score?: number
}

interface GoogleVerifyResponse {
  success: boolean
  score?: number
  action?: string
  challenge_ts?: string
  hostname?: string
  'error-codes'?: string[]
}

/**
 * Verify a reCAPTCHA v3 token. Returns `{ ok: true }` immediately when
 * CAPTCHA is disabled by configuration (the DEV path). When enabled,
 * checks Google's verify endpoint and validates action + score.
 */
export async function verifyCaptcha(
  token: string | undefined | null,
  expectedAction: string,
  remoteIp?: string,
): Promise<CaptchaResult> {
  if (!isEnabled()) return { ok: true }

  const secret = process.env.RECAPTCHA_SECRET
  if (!secret) {
    return { ok: false, reason: 'captcha-misconfigured' }
  }

  if (!token || typeof token !== 'string') {
    return { ok: false, reason: 'captcha-missing' }
  }

  const params = new URLSearchParams()
  params.set('secret', secret)
  params.set('response', token)
  if (remoteIp) params.set('remoteip', remoteIp)

  let data: GoogleVerifyResponse
  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
    if (!res.ok) {
      return { ok: false, reason: `captcha-verify-http-${res.status}` }
    }
    data = (await res.json()) as GoogleVerifyResponse
  } catch (err) {
    return {
      ok: false,
      reason: `captcha-verify-fetch-failed:${(err as Error).message}`,
    }
  }

  if (!data.success) {
    const codes = (data['error-codes'] || []).join(',')
    return { ok: false, reason: `captcha-rejected:${codes || 'unknown'}` }
  }

  if (data.action && data.action !== expectedAction) {
    return {
      ok: false,
      reason: `captcha-action-mismatch:got=${data.action},want=${expectedAction}`,
    }
  }

  const score = typeof data.score === 'number' ? data.score : undefined
  if (score !== undefined && score < scoreThreshold()) {
    return { ok: false, reason: `captcha-low-score:${score}`, score }
  }

  return { ok: true, score }
}

/**
 * Convenience for handlers: returns whether the public-facing site needs
 * to render a CAPTCHA widget. Used by /api/config so the SPA can show
 * the right UI per environment.
 */
export function captchaEnabled(): boolean {
  return isEnabled()
}
