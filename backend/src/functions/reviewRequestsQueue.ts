/**
 * Review-requests queue consumer.
 *
 *   Trigger: Azure Storage Queue (default name: review-requests, override
 *            via REVIEW_QUEUE_NAME). Producers enqueue via
 *            services/queue.ts#enqueueReviewRequest with a visibility
 *            timeout of 72h (configurable), so the message becomes visible
 *            here once the customer has had time with the piece.
 *
 *   Sends the `review_request` WhatsApp template to the customer's phone.
 *   Email fallback isn't wired yet — first iteration is WhatsApp-only
 *   because that's the channel customers actually click through from.
 *
 * Retry semantics mirror notificationsQueue.ts: this handler throws on
 * transient failure so Storage Queue retries up to maxDequeueCount, then
 * moves the message to {queue}-poison for manual review.
 */

import { app, InvocationContext } from '@azure/functions'
import {
  getOrderById,
  appendOrderEvent,
  appendWhatsAppMessage,
  upsertWhatsAppConversation,
  getWhatsAppConversation,
} from '../services/tableStorage'
import { sendTemplateMessage, isWhatsAppConfigured } from '../services/whatsapp'

interface ReviewRequestMessage {
  orderId: string
  userEmail: string
  customerName: string
  customerPhone?: string
  items?: { title: string; productId: string }[]
}

async function processReviewRequest(
  message: ReviewRequestMessage,
  context: InvocationContext,
): Promise<void> {
  const { orderId, customerName } = message
  if (!orderId) {
    context.warn('processReviewRequest: missing orderId - dropping')
    return
  }

  const order = await getOrderById(orderId)
  if (!order) {
    context.warn(`processReviewRequest: order ${orderId} not found - dropping`)
    return
  }

  // Status guard: only send if the order is still DELIVERED. If the customer
  // returned the piece or it got cancelled post-delivery somehow, skip.
  if (order.status !== 'DELIVERED') {
    context.log(`processReviewRequest: order ${orderId} is now ${order.status}, skipping review request`)
    return
  }

  const customerPhone = message.customerPhone || (order.customerPhone as string) || ''
  if (!customerPhone) {
    context.warn(`processReviewRequest: order ${orderId} has no phone - dropping`)
    return
  }
  if (!isWhatsAppConfigured()) {
    context.warn('processReviewRequest: WhatsApp env vars not set - dropping')
    return
  }

  const now = new Date().toISOString()
  const displayName = customerName || (order.customerName as string) || 'Customer'

  try {
    const result = await sendTemplateMessage({
      toPhone: customerPhone,
      templateName: 'review_request',
      // {{1}}=customerName, {{2}}=orderId. The URL button (configured in
      // Meta Manager) carries the orderId as its own parameter.
      bodyVariables: [displayName, orderId],
    })

    await appendOrderEvent({
      partitionKey: orderId,
      rowKey: `${now}_review_request`,
      channel: 'message',
      by: 'system',
      byRole: 'system',
      note: 'Review request sent via WhatsApp',
      meta: JSON.stringify({
        template: 'review_request',
        waMessageId: result.messageId,
      }),
      createdAt: now,
    })

    // Log on the WhatsApp conversation timeline too.
    await appendWhatsAppMessage({
      partitionKey: result.toPhone,
      rowKey: `${now}_outbound_${result.messageId}`,
      direction: 'outbound',
      waMessageId: result.messageId,
      type: 'template',
      templateName: 'review_request',
      text: result.bodyPreview,
      orderId,
      status: 'sent',
      createdAt: now,
      updatedAt: now,
    })

    const existingConv = await getWhatsAppConversation(result.toPhone)
    await upsertWhatsAppConversation({
      partitionKey: 'conv',
      rowKey: result.toPhone,
      phone: result.toPhone,
      customerName: displayName || existingConv?.customerName || '',
      customerEmail: (order.customerEmail as string) || existingConv?.customerEmail || '',
      lastMessageAt: now,
      lastMessagePreview: result.bodyPreview.slice(0, 240),
      lastDirection: 'outbound',
      lastOrderId: orderId,
      unreadCount: existingConv?.unreadCount ?? 0,
      createdAt: existingConv?.createdAt || now,
      updatedAt: now,
    })

    context.log(
      `[review-request] sent orderId=${orderId} to=${result.toPhone} messageId=${result.messageId}`,
    )
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    context.warn(
      `[review-request] failed orderId=${orderId} to=${customerPhone} error="${errMsg}"`,
    )
    // Re-throw so the queue retries (visibility timeout grows on each
    // attempt per host.json). After maxDequeueCount the message moves to
    // review-requests-poison.
    throw err
  }
}

app.storageQueue('processReviewRequests', {
  queueName: '%REVIEW_QUEUE_NAME%',
  connection: 'AzureWebJobsStorage',
  handler: async (message, context) => {
    let parsed: ReviewRequestMessage
    if (typeof message === 'string') {
      try {
        parsed = JSON.parse(message)
      } catch {
        context.warn('processReviewRequests: dropping non-JSON message')
        return
      }
    } else {
      parsed = message as ReviewRequestMessage
    }
    await processReviewRequest(parsed, context)
  },
})
