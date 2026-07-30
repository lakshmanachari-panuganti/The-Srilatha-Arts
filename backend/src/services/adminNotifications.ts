/**
 * Studio-admin WhatsApp fan-out.
 *
 * Reads the STUDIO_ADMINS_WHATSAPP_GROUP env var (comma-separated list of
 * WhatsApp numbers) and delivers an admin template to every valid
 * recipient. Two events use it today:
 *
 *   custom-order submitted  → admin_notification_v1  (→ /admin/custom-orders)
 *   shop order paid         → admin_new_order_v1     (→ /admin/orders)
 *
 * Both templates take the same two body variables:
 *   {{1}} customer name, {{2}} customer mobile number.
 *
 * Delivery goes through the SAME notifications-out queue as customer
 * notifications, so admin pings inherit the guarantees the customer path
 * already has: retry with backoff (host.json maxDequeueCount), a poison
 * queue for permanent failures, and a notificationAlerts row on the admin
 * dashboard when a send fails. The producer only enqueues, so no Meta
 * latency lands on the customer's HTTP request or the payment-verify path.
 *
 * Fan-out shape: ONE queue message PER ADMIN, not one per event. A retry
 * therefore re-sends only to the admin who actually failed — a single
 * message covering the whole group would re-deliver to admins who already
 * received it on the first attempt.
 *
 * Producer contract:
 *   - Invalid / empty phone numbers are dropped (logged as skip).
 *   - An enqueue failure for one admin does NOT stop later admins.
 *   - The caller receives { enqueued, skipped, failed } and never sees a
 *     throw — admin notification is never allowed to fail the business
 *     operation that triggered it.
 */

import { InvocationContext } from '@azure/functions'
import { sendTemplateMessage, normalisePhone, isWhatsAppConfigured } from './whatsapp'
import { enqueueNotification } from './queue'

const ADMIN_GROUP_ENV = 'STUDIO_ADMINS_WHATSAPP_GROUP'
/** Custom-order arrival ping (button → /admin/custom-orders). */
export const ADMIN_CUSTOM_ORDER_TEMPLATE_KEY = 'admin_notification_v1'
/** New paid-order arrival ping (button → /admin/orders). */
export const ADMIN_NEW_ORDER_TEMPLATE_KEY = 'admin_new_order_v1'

/** Queue channel the notifications-out consumer routes on. Distinct from
 *  'whatsapp' because admin pings are not order-scoped: they never touch
 *  whatsappStatus on the order row and never CC the studio. */
export const ADMIN_WHATSAPP_CHANNEL = 'whatsapp_admin'

export interface FanoutResult {
  /** Messages successfully placed on notifications-out. */
  enqueued: number
  /** Admins dropped before enqueue (invalid number, or no admins configured). */
  skipped: number
  /** Admins whose enqueue call itself failed. */
  failed: number
}

/** Parse STUDIO_ADMINS_WHATSAPP_GROUP into a de-duplicated list of
 *  normalised E.164 numbers.
 *
 *  Separator is comma or semicolon ONLY — never whitespace. The setting is
 *  documented as accepting human-formatted numbers ("+91 90143 93938"), and
 *  splitting on whitespace shredded those into unusable fragments that were
 *  then dropped, silently un-notifying that admin.
 *
 *  Each entry must normalise to 10-15 digits: 10 is the shortest real
 *  Indian mobile, 15 is the E.164 maximum. The upper bound is what catches
 *  a whitespace-separated list pasted into the setting — it would otherwise
 *  concatenate into one long bogus number that we'd happily send to. */
export function parseStudioAdminPhones(raw: string | undefined): string[] {
  if (!raw) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const chunk of raw.split(/[,;]+/)) {
    const trimmed = chunk.trim()
    if (!trimmed) continue
    // normalisePhone strips non-digits and prefixes '91' for 10-digit
    // Indian numbers.
    const normalised = normalisePhone(trimmed)
    if (normalised.length < 10 || normalised.length > 15) continue
    if (seen.has(normalised)) continue
    seen.add(normalised)
    out.push(normalised)
  }
  return out
}

export interface EnqueueStudioAdminInput {
  /** Meta template name — one of the ADMIN_*_TEMPLATE_KEY constants. */
  templateName: string
  /** {{1}} — the customer who triggered the event. */
  customerName: string
  /** {{2}} — the customer's mobile number, as entered. */
  customerPhone: string
  /** Order id / custom-order inquiry id. Used as the alert dedup key and
   *  shown on the admin dashboard when delivery fails. */
  referenceId: string
  context: InvocationContext
}

/**
 * Queue the admin ping for every number in STUDIO_ADMINS_WHATSAPP_GROUP.
 * Never throws. Returns a per-admin summary for the caller's log line.
 */
export async function enqueueStudioAdminNotifications(
  input: EnqueueStudioAdminInput,
): Promise<FanoutResult> {
  const { templateName, customerName, customerPhone, referenceId, context } = input
  const result: FanoutResult = { enqueued: 0, skipped: 0, failed: 0 }

  const admins = parseStudioAdminPhones(process.env[ADMIN_GROUP_ENV])
  if (admins.length === 0) {
    context.warn(
      `enqueueStudioAdminNotifications: ${ADMIN_GROUP_ENV} is empty or contains no valid numbers - no admins notified`,
    )
    return result
  }

  for (const toPhone of admins) {
    try {
      await enqueueNotification({
        // Admin pings aren't addressed to a customer mailbox; the field is
        // part of the queue message shape, so carry the reference instead.
        userEmail: '',
        channel: ADMIN_WHATSAPP_CHANNEL,
        templateKey: templateName,
        vars: {
          toPhone,
          customerName: customerName || 'Unknown',
          customerPhone: customerPhone || 'Not provided',
          referenceId,
        },
      })
      result.enqueued += 1
    } catch (err) {
      result.failed += 1
      const msg = err instanceof Error ? err.message : String(err)
      // Per-admin isolation: one bad enqueue must not cost the rest their
      // notification.
      context.warn(
        `[notify] channel=${ADMIN_WHATSAPP_CHANNEL} template=${templateName} outcome=enqueue_failed to=${toPhone} ref=${referenceId} error="${msg.replace(/\s+/g, ' ').slice(0, 200)}"`,
      )
    }
  }

  return result
}

export interface SendAdminTemplateInput {
  toPhone: string
  templateName: string
  customerName: string
  customerPhone: string
}

/**
 * Deliver one admin ping. Called by the notifications-out consumer, which
 * owns the retry/alerting behaviour — so this THROWS on failure rather
 * than swallowing, letting the queue retry the individual admin.
 */
export async function sendAdminTemplate(input: SendAdminTemplateInput) {
  if (!isWhatsAppConfigured()) {
    throw new Error(
      'WhatsApp Cloud API not configured (WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID missing)',
    )
  }
  return sendTemplateMessage({
    toPhone: input.toPhone,
    templateName: input.templateName,
    // Both admin templates are approved under plain 'en'. Unlike the
    // customer templates this is not registry-driven — admin templates
    // deliberately stay out of TEMPLATE_REGISTRY, which is the contract
    // for customer-facing transactional events only.
    languageCode: 'en',
    bodyVariables: [
      input.customerName || 'Unknown',
      input.customerPhone || 'Not provided',
    ],
  })
}
