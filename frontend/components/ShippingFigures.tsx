'use client'

import { useShippingConfig } from '@/hooks/useShippingConfig'
import { formatINR } from '@/lib/format'
import { SHIPPING_DEFAULTS } from '@/lib/site-config'

/**
 * Small client islands that render the admin-controlled shipping numbers.
 * Drop these into otherwise-static server pages (FAQ, shipping-and-returns,
 * product feature strip, hero strip) so the page stays SEO-friendly while
 * the live ₹ values track whatever admin has saved in /admin/settings.
 *
 * Rendering policy (post-audit C4):
 *   - Before the live fetch resolves, we render a sensible DEFAULT from
 *     lib/site-config so the sentence around us always reads completely
 *     (e.g. "Free shipping above ₹2,000" rather than "Free shipping above —").
 *   - Once the live value arrives, we swap it in seamlessly.
 *   - If the fetch fails, the default stays — trustworthy fallback, not
 *     a dangling dash. The default is kept in sync with the live admin
 *     value; the cart enforces the live value at checkout regardless.
 */

export function FreeShippingThreshold() {
  const { data } = useShippingConfig()
  const paise = data?.shipping.freeThreshold ?? SHIPPING_DEFAULTS.freeThresholdPaise
  return <>{formatINR(paise / 100)}</>
}

export function StandardShippingCharge() {
  const { data } = useShippingConfig()
  const paise = data?.shipping.effectiveCharge ?? SHIPPING_DEFAULTS.effectiveChargePaise
  return <>{formatINR(paise / 100)}</>
}
