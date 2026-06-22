'use client'

import { useShippingConfig } from '@/hooks/useShippingConfig'
import { formatINR } from '@/lib/format'

/**
 * Small client islands that render the admin-controlled shipping numbers.
 * Drop these into otherwise-static server pages (FAQ, shipping-and-returns,
 * product feature strip, hero strip) so the page stays SEO-friendly while
 * the live ₹ values track whatever admin has saved in /admin/settings.
 *
 * Rendering policy:
 *   - While the API call is in flight, render an em-dash placeholder. The
 *     fetch is on the order of a few hundred ms on the first paint and
 *     React Query caches the result for the rest of the session, so this
 *     only affects the very first page-load.
 *   - On error / network failure, the placeholder stays — the page text
 *     around it still reads sensibly (e.g. "Free shipping above —" is
 *     visibly broken, which is preferable to silently lying with a value
 *     that may not match what the cart will enforce).
 */

const PLACEHOLDER = '—'

export function FreeShippingThreshold() {
  const { data } = useShippingConfig()
  if (!data) return <>{PLACEHOLDER}</>
  return <>{formatINR(data.shipping.freeThreshold / 100)}</>
}

export function StandardShippingCharge() {
  const { data } = useShippingConfig()
  if (!data) return <>{PLACEHOLDER}</>
  return <>{formatINR(data.shipping.effectiveCharge / 100)}</>
}
