/**
 * Notification template registry - single source of truth for what each
 * customer-facing event sends, on which channels, and whether the studio
 * is CC'd on the email.
 *
 * Adding a new transactional event:
 *
 *   1. Write the email template builder in this directory.
 *   2. Write the WhatsApp template + add a builder in
 *      functions/notificationsQueue.ts WA_TEMPLATE_BUILDERS.
 *   3. Get the WhatsApp template approved in Meta Business Manager.
 *   4. Add an entry to TEMPLATE_REGISTRY below.
 *
 * The dispatcher (functions/notificationsQueue.ts) reads from this
 * registry, fires both channels in parallel, and CC's the studio when
 * `copyStudio: true`. Failure of one channel does not block the other.
 *
 * Excluded by design - these never get studio CC and never get a
 * WhatsApp counterpart from this code path:
 *   - Password reset, OTP, email-verification
 *   - Auth / security notifications
 *   - Internal system alerts, admin-to-admin notifications
 *   - Marketing campaigns, newsletter emails
 *
 * If a future template falls into one of those buckets, set
 * copyStudio: false and category appropriately so its intent is clear.
 */

import type { BuiltEmail } from './shared'
import { buildOrderCraftingEmail } from './orderCrafting'
import { buildOrderShippedEmail } from './orderShipped'
import { buildOrderDeliveredEmail } from './orderDelivered'
import { buildOrderCancelledEmail } from './orderCancelled'
import { buildOrderRefundedEmail } from './orderRefunded'
import { buildOrderOnHoldEmail } from './orderOnHold'
import { buildReviewRequestEmail } from './reviewRequest'
import { buildReturnDeclinedEmail } from './returnDeclined'

/**
 * Unified input every transitional email builder receives. Each builder
 * picks the fields it needs and ignores the rest - keeps the dispatcher
 * single-shape simple.
 */
export interface TransitionEmailInput {
  orderId: string
  customerName: string
  customerEmail: string
  siteUrl?: string
  // Per-event extras (populated by the dispatcher from the notification vars)
  courier?: string
  tracking?: string
  trackingUrl?: string
  cancelReason?: string
  holdReason?: string
  /** Reason supplied by admin when declining a return request. */
  returnDeclineReason?: string
  /** Pre-formatted Indian-rupee string, no symbol. e.g. "4,349" */
  refundAmount?: string
}

export type TransitionEmailBuilder = (input: TransitionEmailInput) => BuiltEmail

/**
 * Which event categories exist. Drives the studio-CC + studio-audit logic.
 * Transactional events get the studio CC; the others never do.
 */
export type EventCategory =
  | 'transactional'   // customer-facing order lifecycle
  | 'auth'            // password reset, OTP, email-verification
  | 'marketing'       // newsletter, campaigns
  | 'internal'        // admin-to-admin, system alerts

export interface NotificationTemplate {
  /** Stable key used by the notification queue. */
  templateKey: string
  /** WhatsApp template name in Meta Business Manager. null = no WA channel. */
  whatsappTemplate: string | null
  /** Language code for the WhatsApp template in Meta Business Manager.
   *  Almost every _v1 template is 'en'; override here when a specific
   *  template was submitted/approved under a different locale (e.g. 'en_US').
   *  If omitted the dispatcher falls back to 'en'. */
  whatsappTemplateLanguage?: string
  /** Email builder. null = no email channel (rare; we want both for transactional). */
  emailBuilder: TransitionEmailBuilder | null
  /** When true, dispatcher appends STUDIO_NOTIFICATION_CC to the email send. */
  copyStudio: boolean
  category: EventCategory
  /** True for the one template that attaches the invoice PDF (order_confirmed).
   *  The dispatcher routes the PDF + the full line-item email through the
   *  existing sendOrderConfirmationEmail path, not the simple registry path. */
  carriesInvoicePdf?: boolean
}

/**
 * The canonical registry. Every customer-facing transactional event lives
 * here. To add a new one, add an entry; the dispatcher picks it up
 * automatically.
 */
export const TEMPLATE_REGISTRY: Record<string, NotificationTemplate> = {
  // ── Customer-facing transactional ──────────────────────────────
  // order_confirmed is special: the dispatcher continues to use the
  // existing sendOrderConfirmationEmail path because it carries the invoice
  // PDF + the line-item table. Registered here so future readers see the
  // complete inventory; emailBuilder stays null so the dispatcher's special
  // path is used.
  order_confirmed: {
    templateKey: 'order_confirmed',
    whatsappTemplate: 'order_confirmation_v1',
    whatsappTemplateLanguage: 'en_US', // approved in Meta under English (US)
    emailBuilder: null, // handled by dispatcher's special-case PDF path
    copyStudio: true,
    category: 'transactional',
    carriesInvoicePdf: true,
  },

  order_crafting: {
    templateKey: 'order_crafting',
    whatsappTemplate: 'order_crafting_v1',
    whatsappTemplateLanguage: 'en',
    emailBuilder: buildOrderCraftingEmail,
    copyStudio: true,
    category: 'transactional',
  },

  order_shipped: {
    templateKey: 'order_shipped',
    whatsappTemplate: 'order_shipped_v1',
    whatsappTemplateLanguage: 'en',
    emailBuilder: buildOrderShippedEmail,
    copyStudio: true,
    category: 'transactional',
  },

  order_delivered: {
    templateKey: 'order_delivered',
    whatsappTemplate: 'order_delivered_v1',
    whatsappTemplateLanguage: 'en',
    emailBuilder: buildOrderDeliveredEmail,
    copyStudio: true,
    category: 'transactional',
  },

  order_cancelled: {
    templateKey: 'order_cancelled',
    whatsappTemplate: 'order_cancelled_v1',
    whatsappTemplateLanguage: 'en',
    emailBuilder: buildOrderCancelledEmail,
    copyStudio: true,
    category: 'transactional',
  },

  order_refunded: {
    templateKey: 'order_refunded',
    whatsappTemplate: 'order_refunded_v1',
    whatsappTemplateLanguage: 'en',
    emailBuilder: buildOrderRefundedEmail,
    copyStudio: true,
    category: 'transactional',
  },

  order_on_hold: {
    templateKey: 'order_on_hold',
    whatsappTemplate: 'order_on_hold_v1',
    whatsappTemplateLanguage: 'en',
    emailBuilder: buildOrderOnHoldEmail,
    copyStudio: true,
    category: 'transactional',
  },

  review_request: {
    templateKey: 'review_request',
    whatsappTemplate: 'review_request_v1',
    whatsappTemplateLanguage: 'en',
    emailBuilder: buildReviewRequestEmail,
    copyStudio: true,
    category: 'transactional',
  },

  return_declined: {
    templateKey: 'return_declined',
    whatsappTemplate: 'return_declined_v1',
    whatsappTemplateLanguage: 'en',
    emailBuilder: (input) =>
      buildReturnDeclinedEmail({
        orderId: input.orderId,
        customerName: input.customerName,
        reason: input.returnDeclineReason,
        siteUrl: input.siteUrl,
      }),
    copyStudio: true,
    category: 'transactional',
  },

  // Razorpay refund webhook previously enqueued `refund_processed` with no
  // handler. Route it to order_refunded so both channels fire consistently
  // from the admin-initiated path AND the webhook path.
  refund_processed: {
    templateKey: 'refund_processed',
    whatsappTemplate: 'order_refunded_v1',
    whatsappTemplateLanguage: 'en',
    emailBuilder: buildOrderRefundedEmail,
    copyStudio: true,
    category: 'transactional',
  },
}

export function getTemplate(templateKey: string): NotificationTemplate | null {
  return TEMPLATE_REGISTRY[templateKey] || null
}

/**
 * Resolve the studio CC list from the STUDIO_NOTIFICATION_CC env var.
 * Comma-separated, whitespace tolerated. Returns [] when the var is
 * empty/unset so the dispatcher can pass it straight through.
 */
export function studioCcList(): string[] {
  const raw = process.env.STUDIO_NOTIFICATION_CC || ''
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}
