/**
 * Azure Storage Queue wrapper (§10 - shared services).
 * Used by order state machine to enqueue notifications, webhooks, review requests.
 */

import { QueueServiceClient } from '@azure/storage-queue'
import { DefaultAzureCredential } from '@azure/identity'

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
    visibilityTimeout: 0,    // visible immediately
    messageTimeToLive: -1,   // never expire
  })
}

/**
 * Enqueue a notification to be sent (WhatsApp/email/push).
 */
export async function enqueueNotification(message: {
  userEmail: string
  channel: string
  templateKey: string
  vars: Record<string, string>
}): Promise<void> {
  await enqueue(NOTIFICATIONS_QUEUE, message)
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
  // Delay configurable via REVIEW_REQUEST_DELAY_SECONDS - default 72h so the
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
