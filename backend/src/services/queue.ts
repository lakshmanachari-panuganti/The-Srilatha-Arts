/**
 * Azure Storage Queue wrapper (§10 - shared services).
 * Used by order state machine to enqueue notifications, webhooks, review requests.
 */

import { QueueServiceClient } from '@azure/storage-queue'
import { DefaultAzureCredential } from '@azure/identity'
import type { InvocationContext } from '@azure/functions'
import { recordAlert } from './notificationAlerts'

const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME!
const credential = new DefaultAzureCredential()

const queueServiceClient = new QueueServiceClient(
  `https://${accountName}.queue.core.windows.net`,
  credential,
)

const NOTIFICATIONS_QUEUE = process.env.NOTIFICATIONS_QUEUE_NAME || 'notifications-out'
const WEBHOOKS_QUEUE = process.env.WEBHOOKS_QUEUE_NAME || 'webhooks-in'
const REVIEW_QUEUE = process.env.REVIEW_QUEUE_NAME || 'review-requests'

async function enqueue(queueName: string, message: unknown): Promise<void> {
  const client = queueServiceClient.getQueueClient(queueName)
  // Base64-encode the JSON message (required by Azure Functions queue trigger).
  const encoded = Buffer.from(JSON.stringify(message)).toString('base64')
  await client.sendMessage(encoded, {
    visibilityTimeout: 0,      // visible immediately
    // 7 days rather than -1 (never expire). A message that can never
    // succeed used to persist forever, so the poison queue was unbounded.
    // Anything still undelivered after a week needs a human, not a retry.
    messageTimeToLive: 7 * 24 * 60 * 60,
  })
}

export interface NotificationMessage {
  userEmail: string
  channel: string
  templateKey: string
  vars: Record<string, string>
}

/**
 * Enqueue a notification to be sent (WhatsApp/email/push).
 * Throws on failure — most producers should prefer enqueueNotificationSafe.
 */
export async function enqueueNotification(message: NotificationMessage): Promise<void> {
  await enqueue(NOTIFICATIONS_QUEUE, message)
}

/**
 * Enqueue a notification, raising a dashboard alert if the enqueue itself
 * fails. Returns true when the message is on the queue.
 *
 * Why this exists: the queue is what gives notifications their retry and
 * their poison-queue paper trail — but only once a message actually lands
 * on it. A failed enqueue has neither. Producers used to swallow that into
 * a context.warn, so a Storage Queue outage silently dropped order
 * confirmations with nothing on the admin dashboard and nothing in the
 * poison queue to replay. This closes the one gap the queue architecture
 * doesn't cover itself.
 *
 * Alerts are recorded as final: nothing retries an enqueue that never
 * happened, so the admin's Resend button on the order is the recovery
 * path. Never throws — a notification failure must not fail the business
 * operation (payment capture, status transition) that triggered it.
 */
export async function enqueueNotificationSafe(
  message: NotificationMessage,
  context: InvocationContext,
): Promise<boolean> {
  try {
    await enqueue(NOTIFICATIONS_QUEUE, message)
    return true
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    // Admin pings carry referenceId (may be a custom-order inquiry id);
    // customer notifications carry orderId.
    const alertKey = message.vars.orderId || message.vars.referenceId || 'unknown'
    context.warn(
      `[notify] channel=${message.channel} template=${message.templateKey} outcome=enqueue_failed orderId=${alertKey} error="${reason.replace(/\s+/g, ' ').slice(0, 200)}"`,
    )
    await recordAlert({
      orderId: alertKey,
      // notificationAlerts models delivery channels; whatsapp_admin rolls
      // up under whatsapp so the dashboard filter stays two-valued.
      channel: message.channel === 'email' ? 'email' : 'whatsapp',
      operation: message.templateKey,
      customerName: message.vars.customerName || '',
      customerContact: message.vars.customerPhone || message.userEmail || '',
      reason: `Could not queue notification: ${reason}`,
      attempt: 1,
      isFinal: true,
    })
    return false
  }
}

/**
 * Enqueue an inbound webhook payload for async processing.
 */
export async function enqueueWebhook(message: {
  source: 'razorpay' | 'courier'
  payload: Record<string, unknown>
  receivedAt: string
}): Promise<void> {
  await enqueue(WEBHOOKS_QUEUE, message)
}

/**
 * Schedule a review request to be sent after delivery.
 */
export async function enqueueReviewRequest(message: {
  orderId: string
  userEmail: string
  customerName: string
  customerPhone?: string
  items: { title: string; productId: string }[]
}): Promise<void> {
  // Delay configurable via REVIEW_REQUEST_DELAY_SECONDS — default 72h so the
  // customer has time with the product. Storage Queue caps at 7 days; we
  // clamp defensively to keep that contract.
  const configured = Number(process.env.REVIEW_REQUEST_DELAY_SECONDS)
  const delay = Math.min(
    Number.isFinite(configured) && configured > 0 ? configured : 259200,
    7 * 24 * 60 * 60,
  )
  const client = queueServiceClient.getQueueClient(REVIEW_QUEUE)
  const encoded = Buffer.from(JSON.stringify(message)).toString('base64')
  await client.sendMessage(encoded, {
    visibilityTimeout: delay,
    messageTimeToLive: -1,
  })
}
