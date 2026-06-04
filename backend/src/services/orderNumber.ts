/**
 * Shared order/invoice number generator.
 *
 * Format: YYYYMMDDHHMMSS (14 digits, IST). One value is used as BOTH the
 * Order ID and Invoice ID - they are the same artefact viewed through
 * two lenses (the order before payment, the invoice after).
 *
 * IST is the studio timezone - using local-server-time would otherwise
 * surface UTC numbers to a customer who placed the order at 8pm IST.
 *
 * Uniqueness: at most one order per second is expected, but two near-
 * simultaneous requests CAN land in the same wall-second. We probe Table
 * Storage by RowKey before returning; on collision we bump by 1 second
 * and retry, up to 5 attempts. The probe uses getOrderById (RowKey scan)
 * which is the only path available without a PK - acceptable because
 * collisions are rare and the scan is bounded by table size.
 */

import { getOrderById } from './tableStorage'

const IST_TZ = 'Asia/Kolkata'

/**
 * Format a Date as YYYYMMDDHHMMSS in IST. Exported for the migration
 * script which needs to reconstruct an order number from an existing
 * createdAt timestamp.
 */
export function formatOrderNumber(d: Date): string {
  // Intl with timeZone gives us IST regardless of where the function
  // host is running. We pull each part separately because toLocaleString
  // emits a localised string we'd have to re-parse.
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d)

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  // Hour can come back as '24' when hour12:false at midnight in some
  // environments - clamp to '00' to keep the string strictly 14 digits.
  const hh = get('hour') === '24' ? '00' : get('hour')
  return `${get('year')}${get('month')}${get('day')}${hh}${get('minute')}${get('second')}`
}

/**
 * Allocate a fresh order/invoice number, guaranteed not to collide with
 * an existing row. Default `now` is the current time - the parameter
 * exists so tests can pin a deterministic timestamp.
 */
export async function generateOrderNumber(now: Date = new Date()): Promise<string> {
  const MAX_ATTEMPTS = 5
  let candidate = formatOrderNumber(now)
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const existing = await getOrderById(candidate)
    if (!existing) return candidate
    // Bump by 1 second and try again. Walking forward (not backward)
    // preserves the property that a numerically-larger ID means "placed
    // later" - admins sort by ID and expect newest-first.
    const bumped = new Date(now.getTime() + (i + 1) * 1000)
    candidate = formatOrderNumber(bumped)
  }
  // Fall back to bumping with a millisecond tail so we never throw on a
  // pathological burst. The 3-digit suffix makes it visually distinct
  // from a normal 14-digit number, which is fine - they're still unique
  // sortable strings.
  return `${formatOrderNumber(now)}${String(now.getMilliseconds()).padStart(3, '0')}`
}

/**
 * Format the public invoice URL for an order number. The path is
 * proxied to Azure Blob by the SWA route in staticwebapp.config.json.
 */
export function invoiceUrlFor(orderNumber: string): string {
  const base = process.env.PUBLIC_SITE_URL || 'https://www.srilatha.art'
  return `${base.replace(/\/+$/, '')}/invoices/${orderNumber}.pdf`
}
