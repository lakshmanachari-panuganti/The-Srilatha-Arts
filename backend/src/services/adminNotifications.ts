/**
 * Studio-admin WhatsApp fan-out.
 *
 * Reads the STUDIO_ADMINS_WHATSAPP_GROUP env var (comma-separated list of
 * WhatsApp numbers) and dispatches the `admin_notification` template to
 * every valid recipient. Used today by the custom-order submission
 * endpoint - kept in its own module so future admin-facing notifications
 * (e.g. contact-form pings, low-stock alerts) can reuse the fan-out
 * without duplicating the parsing + isolation logic.
 *
 * Isolation contract:
 *   - Invalid / empty phone numbers are dropped silently (logged as skip).
 *   - A send failure to one admin does NOT stop later admins.
 *   - The caller receives a summary { attempted, succeeded, failed } and
 *     never throws - fan-out failures are non-fatal for the caller.
 */

import { InvocationContext } from '@azure/functions'
import { sendTemplateMessage, normalisePhone, isWhatsAppConfigured } from './whatsapp'

const ADMIN_GROUP_ENV = 'STUDIO_ADMINS_WHATSAPP_GROUP'
const ADMIN_TEMPLATE_KEY = 'admin_notification'

export interface FanoutResult {
  attempted: number
  succeeded: number
  failed: number
  skipped: number
}

/** Parse STUDIO_ADMINS_WHATSAPP_GROUP into a de-duplicated list of
 *  normalised E.164 numbers. Empty entries and anything that doesn't
 *  survive normalisation to at least 10 digits is dropped. */
export function parseStudioAdminPhones(raw: string | undefined): string[] {
  if (!raw) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const chunk of raw.split(/[,\s;]+/)) {
    const trimmed = chunk.trim()
    if (!trimmed) continue
    const normalised = normalisePhone(trimmed)
    // normalisePhone strips non-digits and prefixes '91' for 10-digit
    // Indian numbers. Anything shorter than 10 digits after normalisation
    // is not a real phone number.
    if (normalised.length < 10) continue
    if (seen.has(normalised)) continue
    seen.add(normalised)
    out.push(normalised)
  }
  return out
}

interface NotifyStudioAdminsInput {
  customerName: string
  customerPhone: string
  context: InvocationContext
}

/**
 * Send the `admin_notification` WhatsApp template to every valid number
 * configured in STUDIO_ADMINS_WHATSAPP_GROUP. Never throws.
 */
export async function notifyStudioAdmins(
  input: NotifyStudioAdminsInput,
): Promise<FanoutResult> {
  const { customerName, customerPhone, context } = input
  const result: FanoutResult = { attempted: 0, succeeded: 0, failed: 0, skipped: 0 }

  const raw = process.env[ADMIN_GROUP_ENV]
  const admins = parseStudioAdminPhones(raw)

  if (admins.length === 0) {
    context.warn(
      `notifyStudioAdmins: ${ADMIN_GROUP_ENV} is empty or contains no valid numbers - no admins notified`,
    )
    return result
  }
  if (!isWhatsAppConfigured()) {
    context.warn(
      'notifyStudioAdmins: WhatsApp Cloud API not configured - skipping fan-out',
    )
    result.skipped = admins.length
    return result
  }

  const bodyVariables = [
    customerName || 'Unknown',
    customerPhone || 'Not provided',
  ]

  for (const toPhone of admins) {
    result.attempted += 1
    try {
      const sent = await sendTemplateMessage({
        toPhone,
        templateName: ADMIN_TEMPLATE_KEY,
        bodyVariables,
      })
      result.succeeded += 1
      context.log(
        `[notify] channel=whatsapp template=${ADMIN_TEMPLATE_KEY} outcome=sent to=${sent.toPhone} messageId=${sent.messageId}`,
      )
    } catch (err) {
      result.failed += 1
      const msg = err instanceof Error ? err.message : String(err)
      // Per-admin isolation: log and continue so the remaining admins
      // still receive the notification.
      context.warn(
        `[notify] channel=whatsapp template=${ADMIN_TEMPLATE_KEY} outcome=failed to=${toPhone} error="${msg.replace(/\s+/g, ' ').slice(0, 200)}"`,
      )
    }
  }

  return result
}
