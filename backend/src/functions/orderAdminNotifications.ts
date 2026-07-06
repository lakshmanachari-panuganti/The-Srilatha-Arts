/**
 * Admin notification + invoice resend endpoints.
 *
 *   POST /api/admin/orders/{id}/resend-email     - re-enqueue order confirmation email
 *   POST /api/admin/orders/{id}/resend-whatsapp  - re-enqueue WhatsApp confirmation
 *   GET  /api/admin/orders/{id}/email-logs       - audit trail of email attempts
 *
 * Resend semantics: self-healing. If the invoice blob is missing it is
 * regenerated from the current order row before the notification is
 * enqueued. The notification queue consumer is the single delivery
 * path - admin actions never call SMTP / WhatsApp directly, so all
 * deliveries are observable via the same logs + retry behaviour.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import {
  getOrderById,
  getEmailLogsForOrder,
  mergeOrder,
  appendAuditLog,
  appendOrderEvent,
} from '../services/tableStorage'
import { ensureInvoicePdf } from '../services/orderFulfillment'
import { enqueueNotification } from '../services/queue'
import { requireAdmin } from '../middleware/adminGuard'
import { enforceCsrf } from '../middleware/csrfGuard'
import {
  jsonResponse,
  errorResponse,
  corsPreflightResponse,
} from '../utils/response'

async function adminResendEmail(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)
  const csrfFail = enforceCsrf(request, origin)
  if (csrfFail) return csrfFail

  const admin = requireAdmin(request)
  if (!admin) return errorResponse('Unauthorized', 401, origin)

  const orderId = request.params.id
  if (!orderId) return errorResponse('Missing order id', 400, origin)

  try {
    const order = await getOrderById(orderId)
    if (!order) return errorResponse('Order not found', 404, origin)
    if (!order.customerEmail) {
      return errorResponse('Order has no customer email', 400, origin)
    }

    // Self-heal: rebuild + upload the PDF if it isn't on blob yet.
    // Cheap when already present (just reads invoiceUrl off the row).
    const invoiceUrl = await ensureInvoicePdf(order, context)

    await enqueueNotification({
      userEmail: order.customerEmail as string,
      channel: 'email',
      templateKey: 'order_confirmed',
      vars: {
        orderId,
        customerName: (order.customerName as string) || 'Customer',
        invoiceUrl,
      },
    })

    const now = new Date().toISOString()
    await mergeOrder(order.partitionKey as string, orderId, {
      emailStatus: 'pending',
      emailLastError: '',
      updatedAt: now,
    })
    await appendOrderEvent({
      partitionKey: orderId,
      rowKey: `${now}_email_resend`,
      channel: 'internal',
      by: admin.adminId,
      byRole: admin.role === 'superadmin' ? 'superadmin' : 'admin',
      note: 'Order confirmation email re-queued by admin',
      createdAt: now,
    })
    await appendAuditLog({
      partitionKey: 'admin',
      rowKey: `${now}_${admin.adminId}`,
      staffId: admin.adminId,
      action: 'order.email.resend',
      resourceType: 'order',
      resourceId: orderId,
      details: JSON.stringify({ invoiceUrl }),
      createdAt: now,
    })

    return jsonResponse({ ok: true, status: 'queued', invoiceUrl }, 200, {}, origin)
  } catch (err) {
    context.error('adminResendEmail failed', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return errorResponse(`Failed to resend email: ${message}`, 500, origin)
  }
}

async function adminResendWhatsApp(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)
  const csrfFail = enforceCsrf(request, origin)
  if (csrfFail) return csrfFail

  const admin = requireAdmin(request)
  if (!admin) return errorResponse('Unauthorized', 401, origin)

  const orderId = request.params.id
  if (!orderId) return errorResponse('Missing order id', 400, origin)

  try {
    const order = await getOrderById(orderId)
    if (!order) return errorResponse('Order not found', 404, origin)
    if (!order.customerPhone) {
      return errorResponse('Order has no customer phone', 400, origin)
    }

    const invoiceUrl = await ensureInvoicePdf(order, context)
    await enqueueNotification({
      userEmail: (order.customerEmail as string) || (order.partitionKey as string) || '',
      channel: 'whatsapp',
      templateKey: 'order_confirmed',
      vars: {
        orderId,
        customerName: (order.customerName as string) || 'Customer',
        customerPhone: order.customerPhone as string,
        invoiceUrl,
      },
    })

    const now = new Date().toISOString()
    await mergeOrder(order.partitionKey as string, orderId, {
      whatsappStatus: 'pending',
      whatsappLastError: '',
      updatedAt: now,
    })
    await appendOrderEvent({
      partitionKey: orderId,
      rowKey: `${now}_wa_resend`,
      channel: 'internal',
      by: admin.adminId,
      byRole: admin.role === 'superadmin' ? 'superadmin' : 'admin',
      note: 'WhatsApp confirmation re-queued by admin',
      createdAt: now,
    })
    await appendAuditLog({
      partitionKey: 'admin',
      rowKey: `${now}_${admin.adminId}`,
      staffId: admin.adminId,
      action: 'order.whatsapp.resend',
      resourceType: 'order',
      resourceId: orderId,
      details: JSON.stringify({ invoiceUrl }),
      createdAt: now,
    })

    return jsonResponse({ ok: true, status: 'queued', invoiceUrl }, 200, {}, origin)
  } catch (err) {
    context.error('adminResendWhatsApp failed', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return errorResponse(`Failed to resend WhatsApp: ${message}`, 500, origin)
  }
}

async function adminListEmailLogs(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)

  const admin = requireAdmin(request)
  if (!admin) return errorResponse('Unauthorized', 401, origin)

  const orderId = request.params.id
  if (!orderId) return errorResponse('Missing order id', 400, origin)

  try {
    const rows = await getEmailLogsForOrder(orderId)
    return jsonResponse(
      {
        logs: rows.map((r) => ({
          to: r.to,
          subject: r.subject,
          templateKey: r.templateKey,
          status: r.status,
          attempt: r.attempt,
          messageId: r.messageId || undefined,
          error: r.error || undefined,
          createdAt: r.createdAt,
        })),
      },
      200,
      {},
      origin,
    )
  } catch (err) {
    context.error('adminListEmailLogs failed', err)
    return errorResponse('Failed to load email logs', 500, origin)
  }
}

app.http('adminResendEmail', {
  methods: ['POST', 'OPTIONS'],
  route: 'api/admin/orders/{id}/resend-email',
  authLevel: 'anonymous',
  handler: adminResendEmail,
})

app.http('adminResendWhatsApp', {
  methods: ['POST', 'OPTIONS'],
  route: 'api/admin/orders/{id}/resend-whatsapp',
  authLevel: 'anonymous',
  handler: adminResendWhatsApp,
})

app.http('adminListEmailLogs', {
  methods: ['GET', 'OPTIONS'],
  route: 'api/admin/orders/{id}/email-logs',
  authLevel: 'anonymous',
  handler: adminListEmailLogs,
})
