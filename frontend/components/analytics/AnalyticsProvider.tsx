'use client'

/**
 * AnalyticsProvider
 *
 * Conditionally loads GA4 (gtag.js) and Meta Pixel (fbq) based on:
 *
 *   1. Environment configuration. The respective `NEXT_PUBLIC_*` IDs must
 *      be set, otherwise the scripts simply don't render (no fallback to
 *      placeholder IDs that would pollute someone else's property).
 *
 *   2. User consent. India's DPDP Act and EU GDPR both expect opt-in for
 *      non-essential analytics. We show a discreet bottom-pinned banner
 *      until the visitor has made a decision; only on "Accept" do the
 *      scripts mount and our `trackEvent` shim (frontend/components/
 *      marketing/v2/shared/analytics.ts) starts firing events into the
 *      dataLayer / fbq.
 *
 * Consent is persisted as a literal `'true' | 'false'` string in
 * localStorage under `tsa_analytics_consent`. The banner re-appears only
 * if no decision has been recorded; "Reject" is sticky.
 *
 * Side-effect contract:
 *   - With consent === 'true' and IDs present, this renders the Google
 *     gtag bootstrap + Meta Pixel <noscript>+inline initialiser. They
 *     wire `window.dataLayer` and `window.fbq` respectively.
 *   - The v2 `trackEvent` shim already pushes to both globals; once the
 *     tags land, every CTA across the Studio Vault rooms (Featured Works,
 *     Process Film, etc.) starts emitting attributable events with no
 *     change to the room components themselves.
 *
 * Operational tasks:
 *   - Configure NEXT_PUBLIC_GA4_ID = G-XXXXXXXXXX in production env
 *   - Configure NEXT_PUBLIC_META_PIXEL_ID = 123456789012345 in production env
 *   - Configure NEXT_PUBLIC_SITE_URL = https://www.srilatha.art (for privacy link)
 *   - Add /privacy-policy mention of analytics + consent cookie
 */

import { useEffect, useState } from 'react'
import Script from 'next/script'
import Link from 'next/link'

const CONSENT_KEY = 'tsa_analytics_consent'

type ConsentState = 'unknown' | 'accepted' | 'rejected'

const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID

/** True when at least one analytics ID is configured. If both are unset
 *  (dev / pre-launch), we render nothing — no scripts, no banner. The
 *  visitor doesn't see a popup asking permission to load tracking that
 *  doesn't exist. The moment either env var lands in production, the
 *  banner activates and tracking starts gating behind consent. */
const HAS_ANY_ANALYTICS = Boolean(GA4_ID || META_PIXEL_ID)

export default function AnalyticsProvider() {
  const [consent, setConsent] = useState<ConsentState>('unknown')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (!HAS_ANY_ANALYTICS) return
    setMounted(true)
    try {
      const stored = window.localStorage.getItem(CONSENT_KEY)
      if (stored === 'true') setConsent('accepted')
      else if (stored === 'false') setConsent('rejected')
    } catch {
      // localStorage may be unavailable (private mode, embedded webview).
      // Treat as unknown — the banner will display and the visitor decides.
    }
  }, [])

  // Pre-launch / dev: no analytics IDs configured → render nothing.
  // The trackEvent shim in v2/shared/analytics.ts already no-ops cleanly
  // when window.dataLayer / window.fbq aren't present, so Studio Vault
  // CTAs continue to work — they just don't emit attributable events yet.
  if (!HAS_ANY_ANALYTICS) return null

  const accept = () => {
    try { window.localStorage.setItem(CONSENT_KEY, 'true') } catch {}
    setConsent('accepted')
  }
  const reject = () => {
    try { window.localStorage.setItem(CONSENT_KEY, 'false') } catch {}
    setConsent('rejected')
  }

  // Avoid hydration mismatch — render nothing until we've checked localStorage.
  if (!mounted) return null

  return (
    <>
      {/* GA4 loader script — external, so no inline JS. */}
      {consent === 'accepted' && GA4_ID && (
        <Script
          id="ga4-loader"
          strategy="afterInteractive"
          src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
        />
      )}

      {/* Meta Pixel noscript pixel — no JS, safe under strict CSP. */}
      {consent === 'accepted' && META_PIXEL_ID && (
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: 'none' }}
            alt=""
            src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
          />
        </noscript>
      )}

      {/* Unified init — external file reads GA4/Meta IDs from data-* attrs
          and wires window.dataLayer + window.fbq. Externalising this block
          is what lets us drop 'unsafe-inline' from the CSP script-src
          (security audit C2). */}
      {consent === 'accepted' && (GA4_ID || META_PIXEL_ID) && (
        <Script
          id="analytics-init"
          strategy="afterInteractive"
          src="/analytics-init.js"
          data-ga4-id={GA4_ID || ''}
          data-meta-pixel-id={META_PIXEL_ID || ''}
        />
      )}

      {/* Consent banner — shows only when the visitor hasn't decided yet.
          Discreet bottom pill, ivory ground + ink text, two buttons. Lives
          above the BottomTabBar so it stays reachable on mobile. */}
      {consent === 'unknown' && (
        <div
          role="region"
          aria-label="Analytics consent"
          className="fixed inset-x-0 bottom-20 lg:bottom-4 z-[60] px-4"
        >
          <div
            className="max-w-3xl mx-auto rounded-2xl shadow-card"
            style={{
              background: 'var(--surface-raised)',
              border: '1px solid rgba(34,27,18,0.15)',
            }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 px-5 py-4">
              <p className="text-sm text-ink/85 flex-1">
                We use analytics cookies to understand how visitors use the studio
                site. No tracking until you accept.{' '}
                <Link
                  href="/privacy-policy"
                  className="underline underline-offset-4 hover:text-ink"
                >
                  Privacy policy
                </Link>
                .
              </p>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={reject}
                  className="inline-flex items-center justify-center min-h-10 px-4 text-xs font-semibold uppercase
                             text-ink/75 hover:text-ink rounded-lg
                             border border-ink/15 hover:border-ink/30 transition-colors duration-300"
                  style={{ letterSpacing: '0.14em' }}
                  data-track="consent_reject"
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={accept}
                  className="inline-flex items-center justify-center min-h-10 px-5 text-xs font-semibold uppercase
                             text-white rounded-lg transition-colors duration-300"
                  style={{
                    letterSpacing: '0.14em',
                    background: 'var(--brand)',
                  }}
                  data-track="consent_accept"
                >
                  Accept
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
