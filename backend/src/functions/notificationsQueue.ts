/**
 * Notifications queue consumer.
 *
 *   Trigger: Azure Storage Queue (default name: notifications-out,
 *            override via NOTIFICATIONS_QUEUE_NAME).
 *
 *   Routes by message.channel:
 *     'email'    + templateKey='order_confirmed'              → SMTP + attach PDF
 *     'whatsapp' + templateKey='order_confirmation_new_artwork' → Cloud API + PDF link
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

  // Self-heal: if the invoice blob is missing (e.g. enqueued before the
  // upload completed, or the blob was deleted), regenerate it. This is
  // why every notification carries the orderId, not just the URL - the
  // URL alone wouldn't tell us how to rebuild.
  const pdfBuffer = await loadOrRegeneratePdf(orderId, order, context)
  const invoiceUrl =
    (vars.invoiceUrl as string) || (order.invoiceUrl as string) || ''

  if (channel === 'email' && templateKey === 'order_confirmed') {
    await sendOrderConfirmationEmail({
      order,
      orderId,
      invoiceUrl,
      pdfBuffer,
      dequeueCount: context.triggerMetadata?.dequeueCount as number | undefined,
      context,
    })
    return
  }

  if (channel === 'whatsapp' && templateKey === 'order_confirmation_new_artwork') {
    await sendWhatsAppConfirmation({
      order,
      orderId,
      invoiceUrl,
      customerName: vars.customerName || (order.customerName as string) || 'Customer',
      customerPhone: vars.customerPhone || (order.customerPhone as string) || '',
      context,
    })
    return
  }

  context.warn(
    `processNotification: no handler for channel=${channel} template=${templateKey}`,
  )
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
}

async function sendOrderConfirmationEmail(input: SendEmailInput): Promise<void> {
  const { order, orderId, invoiceUrl, pdfBuffer, dequeueCount, context } = input
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
    // Re-throw so the queue retries (visibility timeout = backoff).
    throw err
  }
}

interface SendWhatsAppInput {
  order: Record<string, unknown>
  orderId: string
  invoiceUrl: string
  customerName: string
  customerPhone: string
  context: InvocationContext
}

async function sendWhatsAppConfirmation(input: SendWhatsAppInput): Promise<void> {
  const { order, orderId, invoiceUrl, customerName, customerPhone, context } = input
  if (!customerPhone) {
    context.warn(`sendWhatsAppConfirmation: order ${orderId} has no phone - dropping`)
    return
  }
  if (!isWhatsAppConfigured()) {
    context.warn('sendWhatsAppConfirmation: WhatsApp env vars not set')
    await mergeOrder(order.partitionKey as string, orderId, {
      whatsappStatus: 'failed',
      whatsappLastError: 'WhatsApp Cloud API not configured',
      updatedAt: new Date().toISOString(),
    })
    return
  }

  const now = new Date().toISOString()
  try {
    const result = await sendTemplateMessage({
      toPhone: customerPhone,
      templateName: 'order_confirmation_new_artwork',
      bodyVariables: [customerName, orderId],
      documentHeader: {
        link: invoiceUrl,
        filename: `invoice-${orderId}.pdf`,
      },
    })

    await mergeOrder(order.partitionKey as string, orderId, {
      whatsappStatus: 'sent',
      whatsappSentAt: now,
      whatsappLastError: '',
      updatedAt: now,
    })

    await appendOrderEvent({
      partitionKey: orderId,
      rowKey: `${now}_whatsapp`,
      channel: 'message',
      by: 'system',
      byRole: 'system',
      note: 'Order confirmation sent via WhatsApp',
      meta: JSON.stringify({
        template: 'order_confirmation_new_artwork',
        waMessageId: result.messageId,
      }),
      createdAt: now,
    })

    // Log the outbound message + bump the conversation rollup so the
    // admin inbox shows the latest activity.
    await logOutboundWhatsAppMessage({
      phone: result.toPhone,
      waMessageId: result.messageId,
      templateName: 'order_confirmation_new_artwork',
      bodyPreview: result.bodyPreview,
      mediaUrl: invoiceUrl,
      orderId,
      customerName,
      customerEmail: (order.customerEmail as string) || undefined,
      now,
    })
    notify(context, 'log', {
      channel: 'whatsapp',
      template: 'order_confirmation_new_artwork',
      outcome: 'sent',
      orderId,
      to: result.toPhone,
      messageId: result.messageId,
    })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    await mergeOrder(order.partitionKey as string, orderId, {
      whatsappStatus: 'failed',
      whatsappLastError: errMsg,
      updatedAt: now,
    })
    notify(context, 'warn', {
      channel: 'whatsapp',
      template: 'order_confirmation_new_artwork',
      outcome: 'failed',
      orderId,
      to: customerPhone,
      error: errMsg,
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
