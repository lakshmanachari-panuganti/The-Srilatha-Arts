/**
 * Review-requests queue consumer.
 *
 *   Trigger: Azure Storage Queue (default name: review-requests, override
 *            via REVIEW_QUEUE_NAME). Producers enqueue via
 *            services/queue.ts#enqueueReviewRequest with a visibility
 *            timeout of 72h (configurable), so the message becomes visible
 *            here once the customer has had time with the piece.
 *
 *   Fans out to BOTH channels per the dual-channel policy by enqueueing
 *   one message per channel onto the standard notifications-out queue.
 *   The standard dispatcher then runs the registry-based fan-out with
 *   studio CC on the email. This keeps a single canonical send path
 *   instead of duplicating channel-specific logic here.
 *
 * Retry semantics mirror notificationsQueue.ts: this handler throws on
 * transient failure so Storage Queue retries up to maxDequeueCount, then
 * moves the message to {queue}-poison for manual review.
 */

import { app, InvocationContext } from '@azure/functions'
import { getOrderById, appendOrderEvent } from '../services/tableStorage'
import { enqueueNotification } from '../services/queue'

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
  const { orderId, customerName, userEmail } = message
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

  const displayName = customerName || (order.customerName as string) || 'Customer'
  const customerEmail = userEmail || (order.customerEmail as string) || ''
  const customerPhone = message.customerPhone || (order.customerPhone as string) || ''
  const now = new Date().toISOString()

  // Fan out via the standard notifications-out queue. The dispatcher reads
  // the template registry, fires WhatsApp + email in parallel, and CCs the
  // studio on the email per STUDIO_NOTIFICATION_CC. Each channel runs as
  // its own queue message so a transient failure on one doesn't retry the
  // other.
  const vars = {
    orderId,
    customerName: displayName,
    customerPhone,
  }

  const enqueueErrors: string[] = []

  if (customerPhone) {
    try {
      await enqueueNotification({
        userEmail: customerEmail,
        channel: 'whatsapp',
        templateKey: 'review_request',
        vars,
      })
    } catch (err) {
      enqueueErrors.push(`whatsapp:${err instanceof Error ? err.message : String(err)}`)
    }
  } else {
    context.log(`processReviewRequest: order ${orderId} has no phone - skipping WhatsApp`)
  }

  if (customerEmail) {
    try {
      await enqueueNotification({
        userEmail: customerEmail,
        channel: 'email',
        templateKey: 'review_request',
        vars,
      })
    } catch (err) {
      enqueueErrors.push(`email:${err instanceof Error ? err.message : String(err)}`)
    }
  } else {
    context.log(`processReviewRequest: order ${orderId} has no email - skipping email channel`)
  }

  await appendOrderEvent({
    partitionKey: orderId,
    rowKey: `${now}_review_request_enqueued`,
    channel: 'message',
    by: 'system',
    byRole: 'system',
    note: `Review request enqueued (channels: ${customerPhone ? 'whatsapp' : ''}${customerPhone && customerEmail ? '+' : ''}${customerEmail ? 'email' : ''})`,
    meta: JSON.stringify({
      template: 'review_request',
      hasPhone: Boolean(customerPhone),
      hasEmail: Boolean(customerEmail),
      enqueueErrors: enqueueErrors.length ? enqueueErrors : undefined,
    }),
    createdAt: now,
  })

  // If BOTH enqueues failed, throw so the review-requests queue retries
  // this trigger. If only one failed, log but don't retry - the other
  // channel will deliver.
  if (
    enqueueErrors.length > 0 &&
    enqueueErrors.length === (customerPhone ? 1 : 0) + (customerEmail ? 1 : 0)
  ) {
    throw new Error(`processReviewRequest: all enqueues failed (${enqueueErrors.join('; ')})`)
  }

  context.log(
    `[review-request] enqueued orderId=${orderId} phone=${Boolean(customerPhone)} email=${Boolean(customerEmail)}`,
  )
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
