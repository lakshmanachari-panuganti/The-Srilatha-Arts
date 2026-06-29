/**
 * Admin WhatsApp Conversation Center endpoints (view-only).
 *
 *   GET /api/admin/whatsapp/conversations
 *       List threads (newest first), with rollup fields used to render
 *       the inbox left rail.
 *
 *   GET /api/admin/whatsapp/conversations/{phone}
 *       Full message thread for a phone, plus related orders/invoices
 *       derived from any message that referenced an orderId. Side effect:
 *       resets unreadCount to 0 on the conversation row.
 *
 *   GET /api/admin/whatsapp/conversations/{phone}/related
 *       Same related-orders list standalone (no thread payload) for the
 *       inbox right pane when only metadata is needed.
 *
 * Reply UX is intentionally absent at this point - admins read, system
 * sends. See the implementation plan in docs/TODO-2026-06-04.md for
 * the next phase of reply support.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import {
  listWhatsAppConversations,
  listWhatsAppMessagesForPhone,
  upsertWhatsAppConversation,
  getWhatsAppConversation,
  getOrderById,
  Row,
} from '../services/tableStorage'
import { requireAdmin } from '../middleware/adminGuard'
import {
  jsonResponse,
  errorResponse,
  corsPreflightResponse,
} from '../utils/response'
import {
  isV2Configured,
  fetchV2Conversations,
  fetchV2Messages,
  V2Conversation,
  V2Message,
} from '../services/whatsappV2Client'

function conversationToApi(row: Row) {
  return {
    phone: row.rowKey,
    customerName: row.customerName || '',
    customerEmail: row.customerEmail || '',
    lastMessageAt: row.lastMessageAt,
    lastMessagePreview: row.lastMessagePreview || '',
    lastDirection: row.lastDirection || 'outbound',
    lastOrderId: row.lastOrderId || undefined,
    unreadCount: Number(row.unreadCount ?? 0),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function messageToApi(row: Row) {
  return {
    rowKey: row.rowKey,
    direction: row.direction,
    waMessageId: row.waMessageId,
    contextMessageId: row.contextMessageId || undefined,
    type: row.type,
    templateName: row.templateName || undefined,
    text: row.text || '',
    mediaUrl: row.mediaUrl || undefined,
    mediaCaption: row.mediaCaption || undefined,
    orderId: row.orderId || undefined,
    invoiceId: row.invoiceId || undefined,
    status: row.status || undefined,
    statusError: row.statusError || undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function orderToInboxApi(row: Row) {
  return {
    id: row.rowKey,
    status: row.status,
    paymentStatus: row.paymentStatus,
    displayTotal: row.displayTotal,
    invoiceUrl: row.invoiceUrl || undefined,
    customerName: row.customerName,
    createdAt: row.createdAt,
  }
}

// ─── GET /api/admin/whatsapp/conversations ───────────────────

async function adminListConversations(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)

  const admin = requireAdmin(request)
  if (!admin) return errorResponse('Unauthorized', 401, origin)

  try {
    // Fetch local (outbound-only) conversations + v2 (has inbound) in parallel
    const [localRows, v2Convos] = await Promise.all([
      listWhatsAppConversations(),
      isV2Configured() ? fetchV2Conversations() : Promise.resolve(null),
    ])

    // Merge: v2 conversations are the authoritative source for inbound data.
    // Local conversations have outbound data. Merge by phone, keeping the
    // most recent lastMessageAt and combining unread counts.
    const merged = mergeConversations(localRows, v2Convos)

    const query = (request.query.get('q') || '').trim().toLowerCase()
    const filtered = query
      ? merged.filter((c) =>
          [c.phone, c.customerName, c.customerEmail, c.lastMessagePreview]
            .map((v) => (v ? String(v).toLowerCase() : ''))
            .some((v) => v.includes(query)),
        )
      : merged
    return jsonResponse(
      { conversations: filtered },
      200,
      {},
      origin,
    )
  } catch (err) {
    context.error('adminListConversations failed', err)
    return errorResponse('Failed to load conversations', 500, origin)
  }
}

// ─── GET /api/admin/whatsapp/conversations/{phone} ───────────

async function adminGetConversation(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)

  const admin = requireAdmin(request)
  if (!admin) return errorResponse('Unauthorized', 401, origin)

  const phone = request.params.phone
  if (!phone) return errorResponse('Missing phone', 400, origin)

  try {
    // Fetch local messages + v2 messages in parallel.
    // Local has outbound (template sends); v2 has inbound (webhook receipts).
    const [conversation, localMessages, v2Messages] = await Promise.all([
      getWhatsAppConversation(phone),
      listWhatsAppMessagesForPhone(phone),
      isV2Configured() ? fetchV2Messages(phone) : Promise.resolve(null),
    ])

    // Even if we don't have a local conversation row, v2 might have
    // inbound-only threads (customer messaged but no order was placed).
    const hasV2Data = v2Messages && v2Messages.length > 0
    if (!conversation && !hasV2Data) {
      return errorResponse('Conversation not found', 404, origin)
    }

    // Merge messages from both sources, deduplicate by waMessageId,
    // and sort chronologically.
    const mergedMessages = mergeMessages(localMessages, v2Messages)

    // Pull related orders from any message that carried an orderId.
    // De-dup while preserving insertion order (newest order first).
    const orderIds: string[] = []
    for (let i = mergedMessages.length - 1; i >= 0; i -= 1) {
      const id = mergedMessages[i].orderId as string | undefined
      if (id && !orderIds.includes(id)) orderIds.push(id)
    }
    const orderRows = await Promise.all(orderIds.map((id) => getOrderById(id)))
    const orders = orderRows
      .filter((r): r is Row => Boolean(r))
      .map(orderToInboxApi)

    // Mark thread as read - resets unreadCount so the inbox badge
    // disappears for this conversation.
    if (conversation && (conversation.unreadCount ?? 0) > 0) {
      const now = new Date().toISOString()
      await upsertWhatsAppConversation({
        ...conversation,
        unreadCount: 0,
        updatedAt: now,
      })
    }

    // Build conversation summary from local or synthesize from v2 data.
    const convApi = conversation
      ? conversationToApi(conversation)
      : {
          phone,
          customerName: v2Messages?.[0]?.text ? '' : '',
          customerEmail: '',
          lastMessageAt: v2Messages?.[v2Messages.length - 1]?.createdAt || '',
          lastMessagePreview: v2Messages?.[v2Messages.length - 1]?.text || '',
          lastDirection: (v2Messages?.[v2Messages.length - 1]?.direction || 'inbound') as 'inbound' | 'outbound',
          unreadCount: 0,
          createdAt: v2Messages?.[0]?.createdAt || '',
          updatedAt: v2Messages?.[v2Messages.length - 1]?.createdAt || '',
        }

    return jsonResponse(
      {
        conversation: convApi,
        messages: mergedMessages.map(messageToApi),
        relatedOrders: orders,
      },
      200,
      {},
      origin,
    )
  } catch (err) {
    context.error('adminGetConversation failed', err)
    return errorResponse('Failed to load conversation', 500, origin)
  }
}

// ─── Merge helpers ───────────────────────────────────────────

interface MergedConversation {
  phone: string
  customerName: string
  customerEmail: string
  lastMessageAt: string
  lastMessagePreview: string
  lastDirection: 'inbound' | 'outbound'
  lastOrderId?: string
  unreadCount: number
  createdAt: string
  updatedAt: string
}

/**
 * Merge local conversation rows (outbound-only) with v2 conversations
 * (inbound-centric). Key: phone number. When both exist for the same
 * phone, pick the more recent lastMessageAt and sum unread counts.
 */
function mergeConversations(
  localRows: Row[],
  v2Convos: V2Conversation[] | null,
): MergedConversation[] {
  const map = new Map<string, MergedConversation>()

  for (const row of localRows) {
    const phone = String(row.rowKey || '')
    map.set(phone, {
      phone,
      customerName: String(row.customerName || ''),
      customerEmail: String(row.customerEmail || ''),
      lastMessageAt: String(row.lastMessageAt || ''),
      lastMessagePreview: String(row.lastMessagePreview || ''),
      lastDirection: (row.lastDirection as 'inbound' | 'outbound') || 'outbound',
      lastOrderId: row.lastOrderId ? String(row.lastOrderId) : undefined,
      unreadCount: Number(row.unreadCount ?? 0),
      createdAt: String(row.createdAt || ''),
      updatedAt: String(row.updatedAt || ''),
    })
  }

  if (v2Convos) {
    for (const v2 of v2Convos) {
      const phone = v2.phone || ''
      if (!phone) continue
      const existing = map.get(phone)
      if (!existing) {
        // v2-only conversation (inbound messages, no outbound from this backend)
        map.set(phone, {
          phone,
          customerName: v2.customerName || '',
          customerEmail: v2.customerEmail || '',
          lastMessageAt: v2.lastMessageAt || '',
          lastMessagePreview: v2.lastMessagePreview || '',
          lastDirection: v2.lastDirection || 'inbound',
          unreadCount: v2.unreadCount ?? 0,
          createdAt: v2.createdAt || '',
          updatedAt: v2.updatedAt || '',
        })
      } else {
        // Both sources have this phone — merge: most recent wins for display,
        // unread counts sum (v2 tracks inbound unreads).
        const v2Time = new Date(v2.lastMessageAt || 0).getTime()
        const localTime = new Date(existing.lastMessageAt || 0).getTime()
        if (v2Time > localTime) {
          existing.lastMessageAt = v2.lastMessageAt || existing.lastMessageAt
          existing.lastMessagePreview = v2.lastMessagePreview || existing.lastMessagePreview
          existing.lastDirection = v2.lastDirection || existing.lastDirection
          existing.updatedAt = v2.updatedAt || existing.updatedAt
        }
        existing.customerName = existing.customerName || v2.customerName || ''
        existing.customerEmail = existing.customerEmail || v2.customerEmail || ''
        existing.unreadCount += v2.unreadCount ?? 0
      }
    }
  }

  // Sort newest first
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime(),
  )
}

/**
 * Merge local messages (outbound) with v2 messages (inbound + possibly outbound),
 * deduplicate by waMessageId, sort chronologically.
 */
function mergeMessages(localMessages: Row[], v2Messages: V2Message[] | null): Row[] {
  const seen = new Set<string>()
  const result: Row[] = []

  // Local messages first (these are authoritative for outbound status)
  for (const msg of localMessages) {
    const wamid = String(msg.waMessageId || '')
    if (wamid) seen.add(wamid)
    result.push(msg)
  }

  // Add v2 messages that aren't already in local (avoids duplicating outbound
  // messages that v2 might also track once sends are routed through it)
  if (v2Messages) {
    for (const v2Msg of v2Messages) {
      const wamid = v2Msg.waMessageId || ''
      if (wamid && seen.has(wamid)) continue
      if (wamid) seen.add(wamid)
      // Convert V2Message to Row-like shape for messageToApi()
      result.push({
        partitionKey: '',
        rowKey: v2Msg.rowKey || `${v2Msg.createdAt}_${v2Msg.direction}_${wamid}`,
        direction: v2Msg.direction,
        waMessageId: wamid,
        contextMessageId: v2Msg.contextMessageId || '',
        type: v2Msg.type || 'text',
        templateName: v2Msg.templateName || '',
        text: v2Msg.text || '',
        mediaUrl: v2Msg.mediaUrl || '',
        mediaCaption: v2Msg.mediaCaption || '',
        orderId: v2Msg.orderId || '',
        invoiceId: v2Msg.invoiceId || '',
        status: v2Msg.status || '',
        statusError: v2Msg.statusError || '',
        createdAt: v2Msg.createdAt || '',
        updatedAt: v2Msg.updatedAt || '',
      } as Row)
    }
  }

  // Sort chronologically (oldest first for chat display)
  result.sort(
    (a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime(),
  )
  return result
}

// ─── Route registrations ─────────────────────────────────────

app.http('adminListConversations', {
  methods: ['GET', 'OPTIONS'],
  route: 'api/admin/whatsapp/conversations',
  authLevel: 'anonymous',
  handler: adminListConversations,
})

app.http('adminGetConversation', {
  methods: ['GET', 'OPTIONS'],
  route: 'api/admin/whatsapp/conversations/{phone}',
  authLevel: 'anonymous',
  handler: adminGetConversation,
})
