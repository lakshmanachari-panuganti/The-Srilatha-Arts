/**
 * Notifications queue consumer.
 *
 *   Trigger: Azure Storage Queue (default name: notifications-out,
 *            override via NOTIFICATIONS_QUEUE_NAME).
 *
 *   Routes by message.channel:
 *     'email'    + 'order_confirmed'                 → SMTP + attach PDF
 *     'whatsapp' + 'order_confirmed'                 → Cloud API + PDF document header
 *     'whatsapp' + 'order_crafting' | 'order_shipped' |
 *                  'order_cancelled' | 'order_on_hold' |
 *                  'order_refunded' | 'order_delivered' |
 *                  'review_request' | 'return_declined' | 'refund_processed'
 *                                                    → Cloud API, text-only
 *
 * Status-transition WhatsApp templates dispatch through a single
 * sendWhatsAppTemplate path keyed by the WA_TEMPLATE_BUILDERS map. Adding a
 * new template = adding one entry to that map + registering the Meta
 * template name in emailTemplates/registry.ts (whatsappTemplate field) +
 * getting it approved in Meta Business Manager under that same name.
 *
 * Template versioning: the Meta template name is looked up from the
 * registry, so rotating a template (e.g. order_crafting → order_crafting_v2)
 * only requires updating the registry's whatsappTemplate field - no changes
 * to producers or WA_TEMPLATE_BUILDERS keys.
 *
 * Retry strategy: this handler THROWS on failure so the Azure Functions
 * runtime returns the message to the queue. Storage Queue retries up
 * to host.json's maxDequeueCount (5) with the visibilityTimeout
 * implementing the backoff (configured to start at 30s and grow). After
 * the final attempt the message goes to {queue}-poison and the admin
 * can resend via the order detail page.
 *
 * The PDF is ALWAYS read from blob storage - never regenerated here.
 * If the blob is missing the handler attempts ensureInvoicePdf as a
 * self-heal, then proceeds. This keeps the "single source of truth"
 * guarantee: the bytes that go on WhatsApp, the bytes the customer
 * downloads, and the bytes attached to the email are the same bytes.
 */

import { app, InvocationContext } from '@azure/functions'
import {
  getOrderById,
  appendOrderEvent,
  appendEmailLog,
  mergeOrder,
  getOrderItems,
  appendWhatsAppMessage,
  upsertWhatsAppConversation,
  getWhatsAppConversation,
} from '../services/tableStorage'
import { downloadInvoicePdf } from '../services/blobStorage'
import { ensureInvoicePdf } from '../services/orderFulfillment'
import { sendEmail, isEmailConfigured } from '../services/email'
import { sendTemplateMessage, isWhatsAppConfigured } from '../services/whatsapp'
import { buildOrderConfirmationEmail } from '../services/emailTemplates/orderConfirmation'
import {
  getTemplate,
  studioCcList,
  type TransitionEmailInput,
} from '../services/emailTemplates/registry'
import { recordAlert, clearAlert } from '../services/notificationAlerts'
import { getStoreContactNumber } from '../services/storeContact'

// Read from host.json:queues.maxDequeueCount. Hard-coded here as a
// constant - keep in sync if you change it in host.json.
const MAX_DEQUEUE_COUNT = 5

interface QueueMessage {
  userEmail?: string
  channel?: 'email' | 'whatsapp' | 'sms' | 'push'
  templateKey?: string
  vars?: Record<string, string>
}

// Single-line structured marker so App Insights / KQL queries can
// pivot on these dimensions without parsing freeform text:
//
//   traces | where message startswith "[notify]"
//          | extend ... = extract("orderId=(\\S+)", 1, message)
//          | summarize count() by channel, outcome
function notify(
  context: InvocationContext,
  level: 'log' | 'warn' | 'error',
  fields: Record<string, string | number | undefined>,
): void {
  const parts: string[] = []
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null || v === '') continue
    const str = String(v).replace(/\s+/g, ' ').slice(0, 200)
    parts.push(`${k}=${/\s|=/.test(str) ? `"${str}"` : str}`)
  }
  context[level](`[notify] ${parts.join(' ')}`)
}

async function processNotification(
  message: QueueMessage,
  context: InvocationContext,
): Promise<void> {
  const channel = message.channel
  const templateKey = message.templateKey
  const vars = message.vars || {}
  const orderId = vars.orderId

  if (!channel || !templateKey) {
    context.warn('processNotification: missing channel or templateKey - dropping')
    return
  }
  if (!orderId) {
    context.warn(`processNotification: missing orderId for ${channel}/${templateKey} - dropping`)
    return
  }

  const order = await getOrderById(orderId)
  if (!order) {
    context.warn(`processNotification: order ${orderId} not found - dropping`)
    return
  }

  // ── EMAIL CHANNEL ─────────────────────────────────────────────────
  if (channel === 'email') {
    const template = getTemplate(templateKey)
    if (!template) {
      notify(context, 'warn', {
        outcome: 'no_registry_entry',
        channel,
        template: templateKey,
        orderId,
      })
      return
    }
    if (template.category !== 'transactional') {
      // Auth / marketing / internal templates don't belong on this queue
      // (and definitely don't get the studio CC). Drop quietly.
      return
    }

    // order_confirmed is special: carries the invoice PDF + line items.
    if (template.carriesInvoicePdf) {
      const pdfBuffer = await loadOrRegeneratePdf(orderId, order, context)
      const invoiceUrl =
        (vars.invoiceUrl as string) || (order.invoiceUrl as string) || ''
      await sendOrderConfirmationEmail({
        order,
        orderId,
        invoiceUrl,
        pdfBuffer,
        dequeueCount: context.triggerMetadata?.dequeueCount as number | undefined,
        context,
        studioCc: template.copyStudio ? studioCcList() : undefined,
      })
      return
    }

    // Standard transition emails - registry's emailBuilder + studio CC.
    if (template.emailBuilder) {
      await sendTransitionEmail({
        template,
        templateKey,
        vars,
        order,
        orderId,
        context,
      })
      return
    }

    notify(context, 'warn', {
      outcome: 'no_email_builder',
      channel,
      template: templateKey,
      orderId,
    })
    return
  }

  // ── WHATSAPP CHANNEL ──────────────────────────────────────────────
  if (channel === 'whatsapp' && WA_TEMPLATE_BUILDERS[templateKey]) {
    await sendWhatsAppTemplate({ order, orderId, templateKey, vars, context })
    return
  }

  context.warn(
    `processNotification: no handler for channel=${channel} template=${templateKey}`,
  )
}

// ────────────────────────────────────────────────────────────────────
// Standard transition-email send path. Routes through the registry's
// emailBuilder, logs to emailLog + order events, and CCs the studio
// when the template's copyStudio is true. Failures throw so the queue
// retries (visibilityTimeout grows on each attempt per host.json).
// ────────────────────────────────────────────────────────────────────
interface SendTransitionEmailInput {
  template: NonNullable<ReturnType<typeof getTemplate>>
  templateKey: string
  vars: Record<string, string>
  order: Record<string, unknown>
  orderId: string
  context: InvocationContext
}

async function sendTransitionEmail(input: SendTransitionEmailInput): Promise<void> {
  const { template, templateKey, vars, order, orderId, context } = input
  const recipient = (order.customerEmail as string) || ''
  if (!recipient) {
    notify(context, 'warn', {
      outcome: 'no_email_address',
      template: templateKey,
      orderId,
    })
    return
  }
  if (!isEmailConfigured()) {
    notify(context, 'warn', {
      outcome: 'smtp_not_configured',
      template: templateKey,
      orderId,
    })
    // Same rationale as sendOrderConfirmationEmail - surface on dashboard
    // even though we're not throwing for retry. isFinal=true because no
    // queue retry can succeed until the env var is set.
    await recordAlert({
      orderId,
      channel: 'email',
      operation: templateKey,
      customerName: (order.customerName as string) || vars.customerName || '',
      customerContact: recipient,
      reason: 'SMTP not configured (SMTP_USER/SMTP_PASS missing)',
      attempt: (context.triggerMetadata?.dequeueCount as number | undefined) ?? 1,
      isFinal: true,
    })
    return
  }

  const attempt = (context.triggerMetadata?.dequeueCount as number | undefined) ?? 1
  const siteUrl = process.env.PUBLIC_SITE_URL || 'https://www.srilatha.art'

  const builderInput: TransitionEmailInput = {
    orderId,
    customerName: (order.customerName as string) || vars.customerName || 'Customer',
    customerEmail: recipient,
    siteUrl,
    courier: vars.courier,
    tracking: vars.tracking,
    trackingUrl: vars.trackingUrl,
    cancelReason: vars.cancelReason,
    holdReason: vars.holdReason,
    returnDeclineReason: vars.returnDeclineReason || vars.reason,
    refundAmount: vars.refundAmount,
  }

  const built = template.emailBuilder!(builderInput)
  const cc = template.copyStudio ? studioCcList() : undefined

  const now = new Date().toISOString()
  try {
    const result = await sendEmail({
      to: recipient,
      subject: built.subject,
      html: built.html,
      text: built.text,
      cc,
    })

    await appendEmailLog({
      partitionKey: orderId,
      rowKey: `${now}_${templateKey}_${attempt}`,
      orderId,
      to: recipient,
      subject: built.subject,
      templateKey,
      status: 'sent',
      attempt,
      messageId: result.messageId,
      createdAt: now,
    })

    await appendOrderEvent({
      partitionKey: orderId,
      rowKey: `${now}_email_${templateKey}_sent`,
      channel: 'message',
      by: 'system',
      byRole: 'system',
      note: `Email sent (${templateKey}, attempt ${attempt})`,
      meta: JSON.stringify({
        messageId: result.messageId,
        to: recipient,
        cc: cc?.length ? cc : undefined,
      }),
      createdAt: now,
    })

    notify(context, 'log', {
      channel: 'email',
      template: templateKey,
      outcome: 'sent',
      orderId,
      to: recipient,
      cc: cc?.length ? cc.join(',') : undefined,
      attempt,
      messageId: result.messageId,
    })

    // Clear any open alert - transient failure is now resolved.
    await clearAlert(orderId, 'email', templateKey)
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    await appendEmailLog({
      partitionKey: orderId,
      rowKey: `${now}_${templateKey}_${attempt}`,
      orderId,
      to: recipient,
      subject: built.subject,
      templateKey,
      status: 'failed',
      attempt,
      error: errMsg,
      createdAt: now,
    })
    notify(context, 'warn', {
      channel: 'email',
      template: templateKey,
      outcome: 'failed',
      orderId,
      to: recipient,
      attempt,
      error: errMsg,
    })
    await recordAlert({
      orderId,
      channel: 'email',
      operation: templateKey,
      customerName: (order.customerName as string) || vars.customerName || '',
      customerContact: recipient,
      reason: errMsg,
      attempt,
      isFinal: attempt >= MAX_DEQUEUE_COUNT,
    })
    // Re-throw so the queue retries this specific email message. The
    // WhatsApp side fires from its own queue message and isn't affected.
    throw err
  }
}

async function loadOrRegeneratePdf(
  orderId: string,
  order: Record<string, unknown>,
  context: InvocationContext,
): Promise<Buffer> {
  const existing = await downloadInvoicePdf(orderId)
  if (existing) return existing
  context.warn(`loadOrRegeneratePdf: blob missing for ${orderId} - regenerating`)
  await ensureInvoicePdf(order as Parameters<typeof ensureInvoicePdf>[0], context)
  const after = await downloadInvoicePdf(orderId)
  if (!after) {
    throw new Error(`Failed to regenerate invoice PDF for ${orderId}`)
  }
  return after
}

interface SendEmailInput {
  order: Record<string, unknown>
  orderId: string
  invoiceUrl: string
  pdfBuffer: Buffer
  dequeueCount?: number
  context: InvocationContext
  /** Studio addresses to CC. Resolved by the dispatcher from the
   *  notification registry + STUDIO_NOTIFICATION_CC env var. */
  studioCc?: string[]
}

async function sendOrderConfirmationEmail(input: SendEmailInput): Promise<void> {
  const { order, orderId, invoiceUrl, pdfBuffer, dequeueCount, context, studioCc } = input
  const recipient = (order.customerEmail as string) || ''
  if (!recipient) {
    context.warn(`sendOrderConfirmationEmail: order ${orderId} has no customerEmail - dropping`)
    return
  }
  if (!isEmailConfigured()) {
    const errMsg = 'SMTP not configured (SMTP_USER/SMTP_PASS missing)'
    context.warn(`sendOrderConfirmationEmail: ${errMsg}`)
    // Don't throw - this is a config problem, not a transient failure.
    // Throwing would just exhaust queue retries with no chance of
    // success until config is fixed. Operator sets env vars and runs
    // Resend from the admin UI.
    await mergeOrder(order.partitionKey as string, orderId, {
      emailStatus: 'failed',
      emailLastError: errMsg,
      updatedAt: new Date().toISOString(),
    })
    // Surface on the dashboard. isFinal=true because no queue retry can
    // recover from a missing env var - operator action is required.
    await recordAlert({
      orderId,
      channel: 'email',
      operation: 'order_confirmed',
      customerName: (order.customerName as string) || '',
      customerContact: recipient,
      reason: errMsg,
      attempt: (dequeueCount ?? 1) as number,
      isFinal: true,
    })
    notify(context, 'warn', {
      channel: 'email',
      template: 'order_confirmed',
      outcome: 'config_missing',
      orderId,
      to: recipient,
    })
    return
  }

  const attempt = (dequeueCount ?? 1) as number
  const items = await getOrderItems(orderId)
  const built = buildOrderConfirmationEmail({
    orderId,
    invoiceUrl,
    customerName: (order.customerName as string) || 'Customer',
    customerEmail: recipient,
    customerPhone: (order.customerPhone as string) || undefined,
    displayTotal: Number(order.displayTotal ?? 0),
    subtotal: typeof order.subtotal === 'number' ? (order.subtotal as number) : undefined,
    shippingAmount: typeof order.shippingAmount === 'number' ? (order.shippingAmount as number) : undefined,
    discountAmount: typeof order.discountAmount === 'number' ? (order.discountAmount as number) : undefined,
    couponCode: (order.couponCode as string) || undefined,
    razorpayPaymentId: (order.razorpayPaymentId as string) || undefined,
    paymentStatus: (order.paymentStatus as string) || 'CAPTURED',
    shippingAddress: parseAddress(order.shippingAddress),
    items: items.map((i) => ({
      productId: i.rowKey as string,
      title: (i.title as string) || '',
      category: (i.category as string) || '',
      imageUrl: (i.imageUrl as string) || undefined,
      qty: Number(i.qty ?? 1),
      displayPrice: Number(i.displayPrice ?? 0),
    })),
    createdAt: (order.createdAt as string) || new Date().toISOString(),
    siteUrl: process.env.PUBLIC_SITE_URL || 'https://www.srilatha.art',
  })

  const now = new Date().toISOString()
  try {
    const result = await sendEmail({
      to: recipient,
      subject: built.subject,
      html: built.html,
      text: built.text,
      cc: studioCc,
      attachments: [
        {
          filename: `invoice-${orderId}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    })

    await appendEmailLog({
      partitionKey: orderId,
      rowKey: `${now}_${attempt}`,
      orderId,
      to: recipient,
      subject: built.subject,
      templateKey: 'order_confirmed',
      status: 'sent',
      attempt,
      messageId: result.messageId,
      createdAt: now,
    })

    await mergeOrder(order.partitionKey as string, orderId, {
      emailStatus: 'sent',
      emailSentAt: now,
      emailAttempts: attempt,
      emailLastError: '',
      updatedAt: now,
    })

    // Clear any open alert for this order/channel/template - retry succeeded,
    // the failure was transient and is no longer actionable.
    await clearAlert(orderId, 'email', 'order_confirmed')

    await appendOrderEvent({
      partitionKey: orderId,
      rowKey: `${now}_email_sent`,
      channel: 'message',
      by: 'system',
      byRole: 'system',
      note: `Order confirmation email sent (attempt ${attempt})`,
      meta: JSON.stringify({ messageId: result.messageId, to: recipient }),
      createdAt: now,
    })
    notify(context, 'log', {
      channel: 'email',
      template: 'order_confirmed',
      outcome: 'sent',
      orderId,
      to: recipient,
      attempt,
      messageId: result.messageId,
    })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    await appendEmailLog({
      partitionKey: orderId,
      rowKey: `${now}_${attempt}`,
      orderId,
      to: recipient,
      subject: built.subject,
      templateKey: 'order_confirmed',
      status: 'failed',
      attempt,
      error: errMsg,
      createdAt: now,
    })
    await mergeOrder(order.partitionKey as string, orderId, {
      emailStatus: 'failed',
      emailLastError: errMsg,
      emailAttempts: attempt,
      updatedAt: now,
    })
    notify(context, 'warn', {
      channel: 'email',
      template: 'order_confirmed',
      outcome: 'failed',
      orderId,
      to: recipient,
      attempt,
      error: errMsg,
    })

    // Record the failure for the admin dashboard. Upserts by composite
    // key - repeated retries update one row, don't flood the table.
    await recordAlert({
      orderId,
      channel: 'email',
      operation: 'order_confirmed',
      customerName: (order.customerName as string) || '',
      customerContact: recipient,
      reason: errMsg,
      attempt,
      isFinal: attempt >= MAX_DEQUEUE_COUNT,
    })

    // Re-throw so the queue retries (visibility timeout = backoff).
    throw err
  }
}

interface WhatsAppTemplateSpec {
  bodyVariables: string[]
  documentHeader?: { link: string; filename: string }
  /** When the template was approved with a dynamic URL button, Meta requires
   *  the {{1}} substitution to be supplied in the send. */
  urlButton?: { parameter: string; index?: string }
  eventNote: string
}

// Map of registry templateKey → builder. Order of bodyVariables MUST match
// the {{1}}, {{2}}, ... slots in the Meta-Business-Manager template body.
// The Meta template name itself is resolved from the registry's
// whatsappTemplate field (see sendWhatsAppTemplate) - this keeps template
// versioning (order_crafting → order_crafting_v1 → v2) out of producer
// code.
//
// The matching template copy lives in docs/Create_whatsapp_templates/*.txt
// and in the Meta Manager UI; do not edit one without the other.
const WA_TEMPLATE_BUILDERS: Record<
  string,
  (
    vars: Record<string, string>,
    order: Record<string, unknown>,
    orderId: string,
  ) => WhatsAppTemplateSpec | null
> = {
  // order_confirmation_v1 body:
  //   {{1}}=customerName, {{2}}=orderId, {{3}}=storeContact.
  // DOCUMENT header carries the invoice PDF.
  order_confirmed: (vars, order, orderId) => {
    const invoiceUrl = vars.invoiceUrl || (order.invoiceUrl as string) || ''
    if (!invoiceUrl) return null
    return {
      bodyVariables: [
        vars.customerName || 'Customer',
        orderId,
        getStoreContactNumber(),
      ],
      documentHeader: { link: invoiceUrl, filename: `invoice-${orderId}.pdf` },
      eventNote: 'Order confirmation sent via WhatsApp',
    }
  },

  // order_crafting_v1: {{1}}=customerName, {{2}}=orderId, {{3}}=storeContact.
  order_crafting: (vars, _order, orderId) => ({
    bodyVariables: [
      vars.customerName || 'Customer',
      orderId,
      getStoreContactNumber(),
    ],
    eventNote: 'Crafting-started update sent via WhatsApp',
  }),

  // order_shipped_v1: {{1}}=customerName, {{2}}=orderId, {{3}}=courier,
  // {{4}}=tracking, {{5}}=storeContact.
  order_shipped: (vars, _order, orderId) => {
    if (!vars.courier || !vars.tracking) return null
    return {
      bodyVariables: [
        vars.customerName || 'Customer',
        orderId,
        vars.courier,
        vars.tracking,
        getStoreContactNumber(),
      ],
      eventNote: `Shipped update sent via WhatsApp (${vars.courier} · ${vars.tracking})`,
    }
  },

  // order_cancelled_v1: {{1}}=customerName, {{2}}=orderId, {{3}}=storeContact.
  order_cancelled: (vars, _order, orderId) => ({
    bodyVariables: [
      vars.customerName || 'Customer',
      orderId,
      getStoreContactNumber(),
    ],
    eventNote: 'Cancellation notice sent via WhatsApp',
  }),

  // order_on_hold_v1: {{1}}=customerName, {{2}}=orderId, {{3}}=holdReason,
  // {{4}}=storeContact. holdReason is validated as required at the state-
  // machine layer (validateTransitionPayload) so it should always be
  // present here.
  order_on_hold: (vars, _order, orderId) => {
    if (!vars.holdReason) return null
    return {
      bodyVariables: [
        vars.customerName || 'Customer',
        orderId,
        vars.holdReason,
        getStoreContactNumber(),
      ],
      eventNote: 'On-hold notice sent via WhatsApp',
    }
  },

  // order_refunded_v1: {{1}}=customerName, {{2}}=refundAmount
  // (₹, Indian-formatted), {{3}}=orderId, {{4}}=storeContact.
  order_refunded: (vars, _order, orderId) => {
    if (!vars.refundAmount) return null
    return {
      bodyVariables: [
        vars.customerName || 'Customer',
        vars.refundAmount,
        orderId,
        getStoreContactNumber(),
      ],
      eventNote: `Refund notice sent via WhatsApp (₹${vars.refundAmount})`,
    }
  },

  // order_delivered_v1: {{1}}=customerName, {{2}}=orderId, {{3}}=storeContact.
  // Customer-explicit delivery confirmation - fires alongside the courier's
  // own notification so the customer hears it from us too.
  order_delivered: (vars, _order, orderId) => ({
    bodyVariables: [
      vars.customerName || 'Customer',
      orderId,
      getStoreContactNumber(),
    ],
    eventNote: 'Delivery confirmation sent via WhatsApp',
  }),

  // review_request_v1: {{1}}=customerName, {{2}}=reviewLink,
  // {{3}}=storeContact. Sent 72h after delivery via the review-requests
  // queue's visibility timeout. The review link deep-links into the
  // customer's specific order page so the review lands on the right product.
  review_request: (vars, _order, orderId) => {
    const siteUrl = (process.env.PUBLIC_SITE_URL || 'https://www.srilatha.art')
      .replace(/\/+$/, '')
    const reviewLink = `${siteUrl}/account/orders/${orderId}`
    return {
      bodyVariables: [
        vars.customerName || 'Customer',
        reviewLink,
        getStoreContactNumber(),
      ],
      eventNote: 'Review request sent via WhatsApp',
    }
  },

  // return_declined_v1: {{1}}=customerName, {{2}}=orderId, {{3}}=storeContact.
  return_declined: (vars, _order, orderId) => ({
    bodyVariables: [
      vars.customerName || 'Customer',
      orderId,
      getStoreContactNumber(),
    ],
    eventNote: 'Return declined notice sent via WhatsApp',
  }),

  // Razorpay refund webhook enqueues `refund_processed`. Routes to the same
  // Meta template as admin-initiated refunds (order_refunded_v1) so
  // customers hear consistent wording from both paths.
  refund_processed: (vars, _order, orderId) => {
    if (!vars.refundAmount) return null
    return {
      bodyVariables: [
        vars.customerName || 'Customer',
        vars.refundAmount,
        orderId,
        getStoreContactNumber(),
      ],
      eventNote: `Refund webhook notice sent via WhatsApp (₹${vars.refundAmount})`,
    }
  },
}

interface SendWhatsAppTemplateInput {
  order: Record<string, unknown>
  orderId: string
  templateKey: string
  vars: Record<string, string>
  context: InvocationContext
}

async function sendWhatsAppTemplate(input: SendWhatsAppTemplateInput): Promise<void> {
  const { order, orderId, templateKey, vars, context } = input
  const customerName = vars.customerName || (order.customerName as string) || 'Customer'
  const customerPhone = vars.customerPhone || (order.customerPhone as string) || ''

  if (!customerPhone) {
    context.warn(`sendWhatsAppTemplate(${templateKey}): order ${orderId} has no phone - dropping`)
    return
  }
  if (!isWhatsAppConfigured()) {
    const errMsg = 'WhatsApp Cloud API not configured (WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID missing)'
    context.warn(`sendWhatsAppTemplate(${templateKey}): ${errMsg}`)
    await mergeOrder(order.partitionKey as string, orderId, {
      whatsappStatus: 'failed',
      whatsappLastError: errMsg,
      updatedAt: new Date().toISOString(),
    })
    await recordAlert({
      orderId,
      channel: 'whatsapp',
      operation: templateKey,
      customerName: (order.customerName as string) || customerName,
      customerContact: customerPhone,
      reason: errMsg,
      attempt: (context.triggerMetadata?.dequeueCount as number | undefined) ?? 1,
      isFinal: true,
    })
    return
  }

  // Self-heal the invoice blob only when the template actually needs it
  // (DOCUMENT header). Other templates are text-only and skip the blob hop.
  let invoiceUrlForBuilder = vars.invoiceUrl || (order.invoiceUrl as string) || ''
  if (templateKey === 'order_confirmed' && !invoiceUrlForBuilder) {
    await loadOrRegeneratePdf(orderId, order, context)
    const refreshed = await getOrderById(orderId)
    invoiceUrlForBuilder = (refreshed?.invoiceUrl as string) || ''
  }

  const builder = WA_TEMPLATE_BUILDERS[templateKey]
  const spec = builder ? builder({ ...vars, invoiceUrl: invoiceUrlForBuilder }, order, orderId) : null
  if (!spec) {
    // Builder returned null = required variables missing for this template
    // (e.g. order_shipped enqueued without tracking/courier). Don't retry -
    // this is a producer bug, not a transient failure.
    context.warn(`sendWhatsAppTemplate(${templateKey}): missing required vars for ${orderId} - dropping`)
    await mergeOrder(order.partitionKey as string, orderId, {
      whatsappStatus: 'failed',
      whatsappLastError: `Missing required vars for ${templateKey}`,
      updatedAt: new Date().toISOString(),
    })
    return
  }

  // Resolve the Meta template name and language from the registry so template
  // versioning (order_crafting_v1 → v2) only touches registry.ts, not producers.
  // Fallback to templateKey preserves back-compat for any caller not yet in
  // the registry.
  const registryEntry = getTemplate(templateKey)
  const metaTemplateName = registryEntry?.whatsappTemplate || templateKey
  const metaTemplateLanguage = registryEntry?.whatsappTemplateLanguage || 'en'

  const now = new Date().toISOString()
  try {
    const result = await sendTemplateMessage({
      toPhone: customerPhone,
      templateName: metaTemplateName,
      bodyVariables: spec.bodyVariables,
      documentHeader: spec.documentHeader,
      urlButton: spec.urlButton,
      languageCode: metaTemplateLanguage,
    })

    await mergeOrder(order.partitionKey as string, orderId, {
      whatsappStatus: 'sent',
      whatsappSentAt: now,
      whatsappLastError: '',
      updatedAt: now,
    })

    await appendOrderEvent({
      partitionKey: orderId,
      rowKey: `${now}_whatsapp_${templateKey}`,
      channel: 'message',
      by: 'system',
      byRole: 'system',
      note: spec.eventNote,
      meta: JSON.stringify({
        template: templateKey,
        waMessageId: result.messageId,
      }),
      createdAt: now,
    })

    await logOutboundWhatsAppMessage({
      phone: result.toPhone,
      waMessageId: result.messageId,
      templateName: templateKey,
      bodyPreview: result.bodyPreview,
      mediaUrl: spec.documentHeader?.link,
      orderId,
      customerName,
      customerEmail: (order.customerEmail as string) || undefined,
      now,
    })
    notify(context, 'log', {
      channel: 'whatsapp',
      template: templateKey,
      outcome: 'sent',
      orderId,
      to: result.toPhone,
      messageId: result.messageId,
    })

    // Transient failure resolved - clear the open alert for this
    // (order, channel, template).
    await clearAlert(orderId, 'whatsapp', templateKey)
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    const attempt = (context.triggerMetadata?.dequeueCount as number | undefined) ?? 1
    await mergeOrder(order.partitionKey as string, orderId, {
      whatsappStatus: 'failed',
      whatsappLastError: errMsg,
      updatedAt: now,
    })
    notify(context, 'warn', {
      channel: 'whatsapp',
      template: templateKey,
      outcome: 'failed',
      orderId,
      to: customerPhone,
      attempt,
      error: errMsg,
    })
    await recordAlert({
      orderId,
      channel: 'whatsapp',
      operation: templateKey,
      customerName: (order.customerName as string) || customerName,
      customerContact: customerPhone,
      reason: errMsg,
      attempt,
      isFinal: attempt >= MAX_DEQUEUE_COUNT,
    })
    // Throw for queue retry. Three retries with backoff is usually
    // enough to absorb transient WhatsApp 5xx; permanent failures
    // (wrong template, banned number) land in the poison queue and
    // require admin intervention.
    throw err
  }
}

interface LogOutboundInput {
  phone: string                   // already normalised E.164 (no '+')
  waMessageId: string
  templateName: string
  bodyPreview: string
  mediaUrl?: string
  orderId: string
  customerName?: string
  customerEmail?: string
  now: string
}

async function logOutboundWhatsAppMessage(input: LogOutboundInput): Promise<void> {
  const { phone, waMessageId, templateName, bodyPreview, mediaUrl, orderId, customerName, customerEmail, now } = input

  // Per-message row. RowKey encodes time + direction + wamid so the
  // thread is naturally chronological and lookups by wamid stay cheap.
  await appendWhatsAppMessage({
    partitionKey: phone,
    rowKey: `${now}_outbound_${waMessageId}`,
    direction: 'outbound',
    waMessageId,
    type: 'template',
    templateName,
    text: bodyPreview,
    mediaUrl,
    orderId,
    invoiceId: orderId,
    status: 'sent',
    createdAt: now,
    updatedAt: now,
  })

  // Conversation rollup. Preserve any existing unreadCount (admins
  // clear it explicitly via the view-thread endpoint). createdAt is
  // only stamped on first insert.
  const existing = await getWhatsAppConversation(phone)
  await upsertWhatsAppConversation({
    partitionKey: 'conv',
    rowKey: phone,
    phone,
    customerName: customerName || existing?.customerName || '',
    customerEmail: customerEmail || existing?.customerEmail || '',
    lastMessageAt: now,
    lastMessagePreview: bodyPreview.slice(0, 240),
    lastDirection: 'outbound',
    lastOrderId: orderId,
    unreadCount: existing?.unreadCount ?? 0,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  })
}

function parseAddress(raw: unknown): {
  fullName?: string
  phone?: string
  line1?: string
  line2?: string
  city?: string
  state?: string
  pincode?: string
  country?: string
} | undefined {
  if (!raw) return undefined
  if (typeof raw === 'object') {
    return raw as Record<string, string>
  }
  try {
    return JSON.parse(String(raw))
  } catch {
    return undefined
  }
}

app.storageQueue('processNotifications', {
  queueName: '%NOTIFICATIONS_QUEUE_NAME%',
  connection: 'AzureWebJobsStorage',
  handler: async (message, context) => {
    // Azure Queue trigger decodes the base64 body for us and gives us
    // either an object (if the message was JSON) or a string. Our
    // producer (enqueueNotification) always sends JSON, so we expect
    // the object form - guard the string form for hand-curated test
    // messages.
    let parsed: QueueMessage
    if (typeof message === 'string') {
      try {
        parsed = JSON.parse(message)
      } catch {
        context.warn('processNotifications: dropping non-JSON message')
        return
      }
    } else {
      parsed = message as QueueMessage
    }
    await processNotification(parsed, context)
  },
})
