/**
 * Frontend reCAPTCHA v3 helper.
 *
 * Loads the Google grecaptcha script lazily after the runtime config from
 * /api/config tells us the feature is enabled and gives us a site key.
 * The DEV environment turns this off via the backend; the helper returns
 * `null` in that case so callers can safely skip sending a token.
 *
 * Site key + enabled flag are runtime config, not build-time NEXT_PUBLIC_*
 * envs, because both DEV and PRD share the same Next build artefact and
 * we want the enforcement boundary to be the server, not the bundle.
 */

import { apiFetch } from './api'

interface PublicConfig {
  environment?: string
  captcha?: {
    enabled?: boolean
    provider?: string
    siteKey?: string
  }
}

interface CaptchaState {
  enabled: boolean
  siteKey: string
  loadingScript?: Promise<void>
}

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void
      execute: (siteKey: string, opts: { action: string }) => Promise<string>
    }
  }
}

let _state: CaptchaState | null = null
let _stateInFlight: Promise<CaptchaState> | null = null

async function fetchState(): Promise<CaptchaState> {
  if (_state) return _state
  if (_stateInFlight) return _stateInFlight
  _stateInFlight = (async () => {
    try {
      const cfg = await apiFetch<PublicConfig>('/config')
      _state = {
        enabled: Boolean(cfg.captcha?.enabled && cfg.captcha?.siteKey),
        siteKey: cfg.captcha?.siteKey || '',
      }
    } catch {
      // If /config is unreachable we deliberately fall back to "off" so the
      // login pages stay usable. The backend still enforces when configured.
      _state = { enabled: false, siteKey: '' }
    } finally {
      _stateInFlight = null
    }
    return _state!
  })()
  return _stateInFlight
}

function loadScript(siteKey: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.grecaptcha) return Promise.resolve()
  if (_state?.loadingScript) return _state.loadingScript

  const p = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-recaptcha="v3"]',
    )
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('recaptcha-script-error')), { once: true })
      return
    }
    const s = document.createElement('script')
    s.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`
    s.async = true
    s.defer = true
    s.dataset.recaptcha = 'v3'
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('recaptcha-script-error'))
    document.head.appendChild(s)
  })
  if (_state) _state.loadingScript = p
  return p
}

/**
 * Returns whether CAPTCHA is active in this environment. Login forms can
 * use this to render a "protected by reCAPTCHA" badge / privacy notice.
 */
export async function isCaptchaEnabled(): Promise<boolean> {
  const s = await fetchState()
  return s.enabled
}

/**
 * Prime the grecaptcha script before the user submits the form. Safe to
 * call from a useEffect — does nothing in DEV (captcha disabled) and
 * de-duplicates concurrent loads.
 */
export async function prewarmCaptcha(): Promise<void> {
  const s = await fetchState()
  if (!s.enabled) return
  try {
    await loadScript(s.siteKey)
  } catch {
    /* ignored — getCaptchaToken will retry */
  }
}

/**
 * Execute a v3 challenge for the named action and return the verification
 * token, or `null` when CAPTCHA is disabled (DEV) or the script fails to
 * load. Callers should pass the token in the `captchaToken` body field.
 */
export async function getCaptchaToken(action: string): Promise<string | null> {
  const s = await fetchState()
  if (!s.enabled) return null
  if (typeof window === 'undefined') return null

  try {
    await loadScript(s.siteKey)
  } catch {
    return null
  }

  return new Promise<string | null>((resolve) => {
    const g = window.grecaptcha
    if (!g) return resolve(null)
    g.ready(() => {
      g.execute(s.siteKey, { action })
        .then((t) => resolve(t))
        .catch(() => resolve(null))
    })
  })
}
