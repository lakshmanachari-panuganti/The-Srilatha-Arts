/**
 * Shared order/invoice number generator.
 *
 * Format: YYYYMMDDHHMMSSFF (16 digits, IST), where FF is the first two
 * digits of the zero-padded 3-digit millisecond component. One value is
 * used as BOTH the Order ID and Invoice ID - they are the same artefact
 * viewed through two lenses (the order before payment, the invoice
 * after).
 *
 * Example: 2026-06-06 12:45:30.789 IST  →  2026060612453078
 *                                          (.789 → first two digits = "78")
 *
 * The FF suffix gives us 100 unique slots per second (instead of 1 with
 * the previous 14-digit format), making collisions effectively
 * impossible for a single-studio order rate.
 *
 * IST is the studio timezone - using local-server-time would otherwise
 * surface UTC numbers to a customer who placed the order at 8pm IST.
 *
 * Uniqueness: we probe Table Storage by RowKey before returning; on
 * collision we bump by 1 second and retry, up to 5 attempts. The probe
 * uses getOrderById (RowKey scan) which is the only path available
 * without a PK - acceptable because collisions are rare and the scan is
 * bounded by table size. If all 5 attempts collide (i.e. ~500 concurrent
 * writers stomping on the same 5-second window), we throw rather than
 * emit a non-16-digit fallback - the spec demands every ID be exactly
 * 16 digits.
 */

import { createHmac, timingSafeEqual } from 'crypto'
import { getOrderById } from './tableStorage'

const IST_TZ = 'Asia/Kolkata'

// Read lazily inside the helpers below so the module still imports cleanly
// in dev / unit tests where the signing key may legitimately be unset (and
// only the URL builder cares). The download handler validates the key was
// present when it tries to verify a token.
function getInvoiceSigningKey(): string | null {
  return process.env.INVOICE_SIGNING_KEY || null
}

/**
 * Cutover boundary for the invoice-URL HMAC requirement.
 *
 * Order IDs are zero-padded YYYYMMDDHHMMSSFF in IST, so a 16-digit string
 * compare is also a chronological compare. Anything *strictly less than*
 * this value was issued before the HMAC roll-out and is grandfathered in
 * (no token required) so that links already mailed / WhatsApp'd to
 * customers continue to work.
 *
 * Set to a moment safely after the deploy window: 2026-06-08 00:00:00 IST.
 * Orders placed at or after this instant are required to carry a valid
 * token. Anything older — and any non-16-digit legacy ID (TSA-YYYY-HEX
 * format from before the migration) — bypasses the check.
 */
export const INVOICE_TOKEN_CUTOVER = '20260608000000' + '00'

/**
 * Returns true if this invoice ID must carry a valid HMAC token to be
 * downloaded, false if it is grandfathered in (legacy format or issued
 * before the cutover).
 */
export function invoiceRequiresToken(invoiceNumber: string): boolean {
  if (!/^\d{16}$/.test(invoiceNumber)) return false
  return invoiceNumber >= INVOICE_TOKEN_CUTOVER
}

/**
 * Truncated HMAC-SHA256 of the invoice number. 16 bytes (32 hex chars)
 * matches the security level of the CSRF token; full SHA-256 would be
 * 64 hex chars which is overkill in a URL.
 *
 * Returns null when the signing key isn't configured — callers should
 * treat that as "skip token generation" (URL stays unsigned). The
 * download handler refuses to validate against a missing key, so an
 * unsigned URL is rejected for any post-cutover invoice in prd.
 */
export function generateInvoiceToken(invoiceNumber: string): string | null {
  const key = getInvoiceSigningKey()
  if (!key) return null
  const full = createHmac('sha256', key).update(invoiceNumber).digest('hex')
  return full.slice(0, 32)
}

/**
 * Constant-time compare of a caller-supplied token against the expected
 * HMAC for this invoice. Returns false if the signing key is unset, the
 * supplied token is malformed, or the values do not match.
 */
export function verifyInvoiceToken(invoiceNumber: string, supplied: string | null | undefined): boolean {
  if (!supplied) return false
  const expected = generateInvoiceToken(invoiceNumber)
  if (!expected) return false
  if (supplied.length !== expected.length) return false
  try {
    return timingSafeEqual(Buffer.from(supplied, 'utf8'), Buffer.from(expected, 'utf8'))
  } catch {
    return false
  }
}

/**
 * Format a Date as YYYYMMDDHHMMSSFF in IST. Exported for the migration
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
  // environments - clamp to '00' to keep the string strictly digits.
  const hh = get('hour') === '24' ? '00' : get('hour')
  // FF = first two digits of the zero-padded 3-digit millisecond value.
  // Milliseconds are a per-instant fragment - timezone has no effect on
  // them, so we read directly from the Date without going through Intl.
  const ff = String(d.getMilliseconds()).padStart(3, '0').slice(0, 2)
  return `${get('year')}${get('month')}${get('day')}${hh}${get('minute')}${get('second')}${ff}`
}

/**
 * Allocate a fresh order/invoice number, guaranteed not to collide with
 * an existing row. Default `now` is the current time - the parameter
 * exists so tests can pin a deterministic timestamp.
 *
 * Throws if all retry attempts collide (effectively never under normal
 * load - 100 FF slots × 5 retry seconds = 500 unique slots per call).
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
  // Spec says every ID must be exactly 16 digits, so we do not emit a
  // wider fallback - throw and let the caller return a 500. The customer
  // can retry; the collision pressure required to reach this branch
  // means something far more serious is happening upstream.
  throw new Error(
    `generateOrderNumber: could not allocate a unique 16-digit ID after ${MAX_ATTEMPTS} attempts. ` +
    `Last candidate: ${candidate}.`,
  )
}

/**
 * Format the public invoice URL for an order number.
 *
 * Two modes, in priority order:
 *
 *   1. INVOICE_PUBLIC_URL_BASE (preferred when set) — the URL is
 *      `${INVOICE_PUBLIC_URL_BASE}/{orderNumber}.pdf`. Point this at
 *      the Function App's `/api/invoices` route to bypass any
 *      intermediate proxy. Required when the SWA in front of
 *      PUBLIC_SITE_URL is on the Free tier — Free SWA cannot proxy
 *      `/api/*` to a linked backend, so the `${PUBLIC_SITE_URL}/invoices/{id}.pdf`
 *      path silently falls through to the SPA's navigationFallback
 *      and returns 200 + text/html. WhatsApp Cloud then caches that
 *      HTML as the "document" attached to the order-confirmation
 *      template, which lands on the customer's phone as
 *      `invoice-<id>.pdf.html` instead of a real PDF.
 *
 *   2. Fallback to `${PUBLIC_SITE_URL}/invoices/{orderNumber}.pdf`
 *      for Standard-tier SWA setups where the rewrite to the linked
 *      Function backend actually works.
 */
export function invoiceUrlFor(orderNumber: string): string {
  const explicit = process.env.INVOICE_PUBLIC_URL_BASE
  const base = explicit
    ? explicit.replace(/\/+$/, '')
    : `${(process.env.PUBLIC_SITE_URL || 'https://www.srilatha.art').replace(/\/+$/, '')}/invoices`
  const token = generateInvoiceToken(orderNumber)
  const query = token ? `?token=${token}` : ''
  return `${base}/${orderNumber}.pdf${query}`
}
