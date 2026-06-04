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
    const rows = await listWhatsAppConversations()
    const query = (request.query.get('q') || '').trim().toLowerCase()
    const filtered = query
      ? rows.filter((r) =>
          [r.phone, r.customerName, r.customerEmail, r.lastMessagePreview]
            .map((v) => (v ? String(v).toLowerCase() : ''))
            .some((v) => v.includes(query)),
        )
      : rows
    return jsonResponse(
      { conversations: filtered.map(conversationToApi) },
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
    const [conversation, messages] = await Promise.all([
      getWhatsAppConversation(phone),
      listWhatsAppMessagesForPhone(phone),
    ])
    if (!conversation) return errorResponse('Conversation not found', 404, origin)

    // Pull related orders from any message that carried an orderId.
    // De-dup while preserving insertion order (newest order first).
    const orderIds: string[] = []
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const id = messages[i].orderId as string | undefined
      if (id && !orderIds.includes(id)) orderIds.push(id)
    }
    const orderRows = await Promise.all(orderIds.map((id) => getOrderById(id)))
    const orders = orderRows
      .filter((r): r is Row => Boolean(r))
      .map(orderToInboxApi)

    // Mark thread as read - resets unreadCount so the inbox badge
    // disappears for this conversation.
    if ((conversation.unreadCount ?? 0) > 0) {
      const now = new Date().toISOString()
      await upsertWhatsAppConversation({
        ...conversation,
        unreadCount: 0,
        updatedAt: now,
      })
    }

    return jsonResponse(
      {
        conversation: conversationToApi(conversation),
        messages: messages.map(messageToApi),
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
