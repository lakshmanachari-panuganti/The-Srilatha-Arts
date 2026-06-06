/**
 * WhatsApp Cloud API webhook endpoint.
 *
 *   GET  /api/webhooks/whatsapp   - Meta verification challenge
 *   POST /api/webhooks/whatsapp   - inbound messages + status updates
 *
 * Verification:
 *   GET:  Meta hits the URL with hub.mode=subscribe + hub.verify_token
 *         + hub.challenge query params on subscribe / re-subscribe.
 *         We check the verify token against
 *         WHATSAPP_WEBHOOK_VERIFY_TOKEN and echo the challenge back.
 *   POST: every payload is signed with the App Secret. We HMAC-SHA256
 *         the raw body, compare against the X-Hub-Signature-256
 *         header, and drop the payload on mismatch. Mirrors the
 *         pattern in functions/payments.ts:razorpayWebhook so the two
 *         feel familiar.
 *
 * Processing:
 *   - Customer messages (entry[].changes[].value.messages[]) become
 *     inbound rows in `whatsappMessages` + bump the conversation
 *     rollup's lastMessageAt + unreadCount.
 *   - Status updates (entry[].changes[].value.statuses[]) merge into
 *     the matching outbound message row, flipping its status from
 *     'sent' to 'delivered' / 'read' / 'failed'.
 *
 * The handler ALWAYS returns 200 for accepted payloads (even when we
 * silently drop unknown shapes). Meta retries non-2xx aggressively, so
 * returning 4xx for "junk" we can't parse just creates a hot loop in
 * their infra; we'd rather log + drop.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import {
  verifyWebhookSignature,
  verifyWebhookChallenge,
} from '../services/whatsapp'
import {
  appendWhatsAppMessage,
  upsertWhatsAppConversation,
  getWhatsAppConversation,
  findWhatsAppMessageByWamid,
  updateWhatsAppMessageStatus,
  mergeOrder,
  getOrderById,
} from '../services/tableStorage'

interface MetaTextPayload { body?: string }
interface MetaMediaPayload { id?: string; mime_type?: string; sha256?: string; link?: string; caption?: string; filename?: string }
interface MetaContextPayload { from?: string; id?: string }
interface MetaInboundMessage {
  from?: string
  id?: string
  timestamp?: string
  type?: string
  text?: MetaTextPayload
  image?: MetaMediaPayload
  document?: MetaMediaPayload
  audio?: MetaMediaPayload
  video?: MetaMediaPayload
  sticker?: MetaMediaPayload
  context?: MetaContextPayload
}
interface MetaStatusEntry {
  id?: string                     // wamid we sent
  recipient_id?: string           // customer phone (E.164 without '+')
  status?: 'sent' | 'delivered' | 'read' | 'failed'
  timestamp?: string
  errors?: Array<{ code?: number; title?: string; message?: string }>
}
interface MetaContact { profile?: { name?: string }; wa_id?: string }
interface MetaChangeValue {
  messaging_product?: string
  metadata?: { display_phone_number?: string; phone_number_id?: string }
  contacts?: MetaContact[]
  messages?: MetaInboundMessage[]
  statuses?: MetaStatusEntry[]
}
interface MetaChange { value?: MetaChangeValue; field?: string }
interface MetaEntry { id?: string; changes?: MetaChange[] }
interface MetaWebhookPayload { object?: string; entry?: MetaEntry[] }

// ─── GET /api/webhooks/whatsapp ──────────────────────────────

async function verifyEndpoint(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const mode = request.query.get('hub.mode')
  const token = request.query.get('hub.verify_token')
  const challenge = request.query.get('hub.challenge') || ''
  if (mode === 'subscribe' && verifyWebhookChallenge(token)) {
    context.log('whatsappWebhook: verification challenge accepted')
    return { status: 200, body: challenge }
  }
  context.warn('whatsappWebhook: verification token mismatch')
  return { status: 403, body: 'verification failed' }
}

// ─── POST /api/webhooks/whatsapp ─────────────────────────────

async function receiveWebhook(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const rawBody = await request.text()
  const signature =
    request.headers.get('x-hub-signature-256') ||
    request.headers.get('X-Hub-Signature-256') ||
    ''

  if (!verifyWebhookSignature(rawBody, signature)) {
    context.warn('whatsappWebhook: signature mismatch')
    return { status: 401, body: 'bad signature' }
  }

  let payload: MetaWebhookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return { status: 200, body: 'ok - non-json dropped' }
  }

  if (payload.object !== 'whatsapp_business_account') {
    return { status: 200, body: 'ok - ignored non-whatsapp payload' }
  }

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== 'messages') continue
      const value = change.value || {}
      const contactByWaId = new Map<string, MetaContact>()
      for (const c of value.contacts || []) {
        if (c.wa_id) contactByWaId.set(c.wa_id, c)
      }

      for (const msg of value.messages || []) {
        try {
          await persistInboundMessage(msg, contactByWaId, context)
        } catch (err) {
          context.error('whatsappWebhook: persist inbound failed', err)
        }
      }

      for (const st of value.statuses || []) {
        try {
          await applyStatusUpdate(st, context)
        } catch (err) {
          context.error('whatsappWebhook: status update failed', err)
        }
      }
    }
  }

  return { status: 200, body: 'ok' }
}

async function persistInboundMessage(
  msg: MetaInboundMessage,
  contactByWaId: Map<string, MetaContact>,
  context: InvocationContext,
): Promise<void> {
  const phone = msg.from || ''
  const wamid = msg.id || ''
  if (!phone || !wamid) {
    context.warn('whatsappWebhook: inbound missing from/id - skipping')
    return
  }
  const tsMs = msg.timestamp ? Number(msg.timestamp) * 1000 : Date.now()
  const ts = new Date(tsMs).toISOString()
  const type = (msg.type || 'unknown') as string
  const text = extractText(msg)
  const media = extractMedia(msg)

  await appendWhatsAppMessage({
    partitionKey: phone,
    rowKey: `${ts}_inbound_${wamid}`,
    direction: 'inbound',
    waMessageId: wamid,
    contextMessageId: msg.context?.id || '',
    type,
    text: text || '',
    mediaUrl: media?.link || '',
    mediaCaption: media?.caption || '',
    rawPayload: safeStringify(msg, 32_000),
    createdAt: ts,
    updatedAt: ts,
  })

  // Bump the conversation rollup. Inbound increments unreadCount so
  // the admin inbox can highlight new replies; admin viewing a thread
  // resets it (handled in the admin endpoints).
  const existing = await getWhatsAppConversation(phone)
  const profileName = contactByWaId.get(phone)?.profile?.name
  await upsertWhatsAppConversation({
    partitionKey: 'conv',
    rowKey: phone,
    phone,
    customerName: existing?.customerName || profileName || '',
    customerEmail: existing?.customerEmail || '',
    lastMessageAt: ts,
    lastMessagePreview: (text || media?.caption || `[${type}]`).slice(0, 240),
    lastDirection: 'inbound',
    lastOrderId: existing?.lastOrderId || '',
    unreadCount: (existing?.unreadCount ?? 0) + 1,
    createdAt: existing?.createdAt || ts,
    updatedAt: ts,
  })
}

async function applyStatusUpdate(
  st: MetaStatusEntry,
  context: InvocationContext,
): Promise<void> {
  const wamid = st.id || ''
  if (!wamid || !st.status) return

  const row = await findWhatsAppMessageByWamid(wamid)
  if (!row) {
    // Status arrived before we logged the outbound row (rare race) or
    // for a message we didn't send. Either way it isn't actionable
    // here. Logged for diagnostics only.
    context.warn(`whatsappWebhook: status for unknown wamid=${wamid} status=${st.status}`)
    return
  }

  const errorMsg = st.errors?.[0]?.message || st.errors?.[0]?.title
  await updateWhatsAppMessageStatus(
    row.partitionKey as string,
    row.rowKey as string,
    st.status,
    errorMsg,
  )

  // Reflect failures back onto the order so the admin notification
  // panel turns red without anyone having to dig into the message
  // log. Delivered/read are quieter - we don't flip the order rollup
  // for those, they're informational.
  if (st.status === 'failed' && row.orderId) {
    try {
      const order = await getOrderById(row.orderId as string)
      if (order) {
        await mergeOrder(order.partitionKey as string, order.rowKey as string, {
          whatsappStatus: 'failed',
          whatsappLastError: errorMsg || 'Delivery failed',
          updatedAt: new Date().toISOString(),
        })
      }
    } catch (err) {
      context.warn('whatsappWebhook: could not reflect failed status on order', err)
    }
  }
}

function extractText(msg: MetaInboundMessage): string {
  if (msg.text?.body) return msg.text.body
  if (msg.image?.caption) return msg.image.caption
  if (msg.video?.caption) return msg.video.caption
  if (msg.document?.caption) return msg.document.caption
  return ''
}

function extractMedia(msg: MetaInboundMessage): MetaMediaPayload | null {
  return msg.image || msg.video || msg.audio || msg.document || msg.sticker || null
}

function safeStringify(obj: unknown, maxBytes: number): string {
  const s = JSON.stringify(obj)
  return s.length > maxBytes ? s.slice(0, maxBytes) : s
}

// ─── Route registrations ─────────────────────────────────────

app.http('whatsappWebhookVerify', {
  methods: ['GET'],
  route: 'api/webhooks/whatsapp',
  authLevel: 'anonymous',
  handler: verifyEndpoint,
})

app.http('whatsappWebhookReceive', {
  methods: ['POST'],
  route: 'api/webhooks/whatsapp',
  authLevel: 'anonymous',
  handler: receiveWebhook,
})
