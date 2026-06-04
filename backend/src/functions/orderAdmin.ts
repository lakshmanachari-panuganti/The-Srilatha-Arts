/**
 * Admin Order Endpoints (§5.1).
 *
 * GET    /api/admin/orders                 - filtered list
 * GET    /api/admin/orders/{id}            - full detail
 * PATCH  /api/admin/orders/{id}/status     - transition via state machine
 * POST   /api/admin/orders/{id}/notes      - internal admin note
 * GET    /api/admin/orders/{id}/events     - full activity log
 * PATCH  /api/admin/orders/bulk-status     - bulk advance
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import {
  getOrderById,
  getOrderItems,
  getOrderEvents,
  mergeOrder,
  appendOrderEvent,
  upsertOrderByStatus,
  deleteOrderByStatus,
  getOrdersByStatus,
  getAllOrders,
  appendAuditLog,
  Row,
} from '../services/tableStorage'
import { requireAdmin, AdminContext } from '../middleware/adminGuard'
import { enforceCsrf } from '../middleware/csrfGuard'
import { jsonResponse, errorResponse, corsPreflightResponse } from '../utils/response'
import { createRefund } from '../services/razorpay'
import {
  canTransition,
  validateTransitionPayload,
  isValidStatus,
  getTransitionNotifications,
  nextValidStates,
  statusLabel,
} from '../services/orderState'
import { enqueueNotification } from '../services/queue'
import type { OrderStatus } from '../types'
import type { TransitionPayload } from '../services/orderState'

function toApi(row: Row) {
  return {
    id: row.rowKey,
    status: row.status,
    paymentStatus: row.paymentStatus,
    items: safeJson(row.items),
    totalAmount: row.totalAmount,
    displayTotal: row.displayTotal,
    subtotal: row.subtotal,
    shippingAmount: row.shippingAmount,
    discountAmount: row.discountAmount ?? 0,
    couponCode: row.couponCode || undefined,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    customerPhone: row.customerPhone,
    shippingAddress: safeJson(row.shippingAddress),
    trackingNumber: row.trackingNumber || undefined,
    courier: row.courier || undefined,
    courierUrl: row.courierUrl || undefined,
    eta: row.eta || undefined,
    cancelReason: row.cancelReason || undefined,
    holdReason: row.holdReason || undefined,
    razorpayOrderId: row.razorpayOrderId || undefined,
    razorpayPaymentId: row.razorpayPaymentId || undefined,
    razorpayRefundId: row.razorpayRefundId || undefined,
    invoiceUrl: row.invoiceUrl || undefined,
    customerNote: row.customerNote || undefined,
    // Notification status surfaces in the admin detail page so support
    // can see at a glance whether the customer was actually notified
    // (and what to retry if not).
    emailStatus: row.emailStatus || undefined,
    emailSentAt: row.emailSentAt || undefined,
    emailAttempts: row.emailAttempts ?? undefined,
    emailLastError: row.emailLastError || undefined,
    whatsappStatus: row.whatsappStatus || undefined,
    whatsappSentAt: row.whatsappSentAt || undefined,
    whatsappLastError: row.whatsappLastError || undefined,
    // Return-flow metadata so the admin order detail page can render the
    // customer's reason / comment / photos and any prior decline / refund.
    returnRequestedAt: row.returnRequestedAt || undefined,
    returnReason: row.returnReason || undefined,
    returnComment: row.returnComment || undefined,
    returnPhotos: safeJson(row.returnPhotos) || [],
    returnDeclineReason: row.returnDeclineReason || undefined,
    refundedAt: row.refundedAt || undefined,
    refundAmount: row.refundAmount || undefined,
    refundFailureReason: row.refundFailureReason || undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function safeJson(val: unknown): unknown {
  if (!val) return undefined
  if (typeof val === 'object') return val
  try { return JSON.parse(String(val)) } catch { return val }
}

// ─── GET /api/admin/orders ───────────────────────────────────

async function adminListOrders(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)

  const admin = requireAdmin(request)
  if (!admin) return errorResponse('Unauthorized', 401, origin)

  try {
    const status = request.query.get('status')
    const page = parseInt(request.query.get('page') || '1', 10)
    const size = parseInt(request.query.get('size') || '20', 10)
    const q = request.query.get('q')?.toLowerCase()

    if (status && isValidStatus(status)) {
      // Use secondary index for fast status filter
      const result = await getOrdersByStatus(status, page, size)
      return jsonResponse(
        {
          orders: result.rows.map((r) => ({
            id: r.orderId,
            status,
            customerName: r.customerName,
            displayTotal: r.displayTotal,
            paymentStatus: r.paymentStatus,
            createdAt: r.createdAt,
          })),
          total: result.total,
          page,
          size,
        },
        200,
        {},
        origin,
      )
    }

    // Full scan with optional search
    let orders = await getAllOrders()
    if (q) {
      orders = orders.filter(
        (o) =>
          o.rowKey?.toLowerCase().includes(q) ||
          o.customerName?.toLowerCase().includes(q) ||
          o.customerEmail?.toLowerCase().includes(q) ||
          o.customerPhone?.includes(q),
      )
    }

    const total = orders.length
    const paged = orders.slice((page - 1) * size, page * size)

    return jsonResponse(
      { orders: paged.map(toApi), total, page, size },
      200,
      {},
      origin,
    )
  } catch (err) {
    context.error('adminListOrders failed', err)
    return errorResponse('Failed to load orders', 500, origin)
  }
}

// ─── GET /api/admin/orders/{id} ──────────────────────────────

async function adminGetOrder(
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
    const order = await getOrderById(orderId)
    if (!order) return errorResponse('Order not found', 404, origin)

    const items = await getOrderItems(orderId)
    const events = await getOrderEvents(orderId, true) // admin sees internal notes

    return jsonResponse(
      {
        order: toApi(order),
        items: items.map((i) => ({
          productId: i.rowKey,
          title: i.title,
          category: i.category,
          imageUrl: i.imageUrl,
          price: i.price,
          displayPrice: i.displayPrice,
          qty: i.qty,
        })),
        events: events.map((e) => ({
          id: e.rowKey,
          fromStatus: e.fromStatus || undefined,
          toStatus: e.toStatus || undefined,
          channel: e.channel,
          by: e.by,
          byRole: e.byRole,
          note: e.note || undefined,
          meta: safeJson(e.meta) || undefined,
          createdAt: e.createdAt,
        })),
        nextStates: nextValidStates(order.status as OrderStatus).map((s) => ({
          status: s,
          label: statusLabel(s),
        })),
      },
      200,
      {},
      origin,
    )
  } catch (err) {
    context.error('adminGetOrder failed', err)
    return errorResponse('Failed to load order', 500, origin)
  }
}

// ─── PATCH /api/admin/orders/{id}/status ─────────────────────

async function adminUpdateStatus(
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

    const body = (await request.json()) as {
      to: string
      note?: string
      notifyCustomer?: boolean
      tracking?: string
      courier?: string
      cancelReason?: string
      holdReason?: string
      refundAmount?: number
    }

    if (!body.to || !isValidStatus(body.to)) {
      return errorResponse(`Invalid target status: ${body.to}`, 400, origin)
    }

    const from = order.status as OrderStatus
    const to = body.to as OrderStatus

    if (!canTransition(from, to)) {
      return errorResponse(
        `Cannot transition from ${from} to ${to}`,
        400,
        origin,
      )
    }

    const payload: TransitionPayload = {
      tracking: body.tracking,
      courier: body.courier,
      cancelReason: body.cancelReason,
      holdReason: body.holdReason,
      refundAmount: body.refundAmount,
      note: body.note,
      notifyCustomer: body.notifyCustomer,
    }

    const validationError = validateTransitionPayload(to, payload)
    if (validationError) return errorResponse(validationError, 400, origin)

    const now = new Date().toISOString()

    // Razorpay refund - runs FIRST when moving to REFUNDED on a card/UPI/
    // netbanking order, so we don't mark the order REFUNDED in our system
    // unless the gateway accepted the refund. Failure here keeps the order
    // at whatever it was before and surfaces the gateway's error to admin.
    let razorpayRefundId: string | undefined
    if (to === 'REFUNDED' && body.refundAmount && order.razorpayPaymentId) {
      try {
        const refund = await createRefund({
          paymentId: order.razorpayPaymentId,
          amountPaise: Math.floor(body.refundAmount),
          notes: {
            internalOrderId: orderId,
            initiatedBy: admin.adminId,
            reason: order.returnReason || 'admin_initiated',
          },
        })
        razorpayRefundId = refund.id
      } catch (refundErr) {
        const message = refundErr instanceof Error ? refundErr.message : 'Razorpay refund failed'
        context.error(`adminUpdateStatus: Razorpay refund failed for ${orderId}`, refundErr)
        await mergeOrder(order.partitionKey, orderId, {
          refundFailureReason: message.slice(0, 500),
          updatedAt: now,
        })
        await appendOrderEvent({
          partitionKey: orderId,
          rowKey: `${now}_refund_failed`,
          channel: 'internal',
          by: admin.adminId,
          byRole: admin.role,
          note: `Razorpay refund failed: ${message}`,
          createdAt: now,
        })
        return errorResponse(`Razorpay refund failed: ${message}`, 502, origin)
      }
    }

    // 1. Update order row (merge, no row move)
    const updates: Row = {
      status: to,
      updatedAt: now,
    }
    if (body.tracking) updates.trackingNumber = body.tracking
    if (body.courier) updates.courier = body.courier
    if (body.cancelReason) updates.cancelReason = body.cancelReason
    if (body.holdReason) updates.holdReason = body.holdReason
    if (body.refundAmount) {
      updates.refundAmount = body.refundAmount
      updates.refundedAt = now
    }
    if (razorpayRefundId) {
      updates.razorpayRefundId = razorpayRefundId
      // Also reflect the refund on the payment-status field so the
      // admin orders list shows REFUNDED at a glance.
      updates.paymentStatus = 'REFUNDED'
      // Clear any previous failure note now that the refund went through.
      updates.refundFailureReason = ''
    }

    await mergeOrder(order.partitionKey, orderId, updates)

    // 2. Update secondary index
    try {
      await deleteOrderByStatus(from, `${order.createdAt}_${orderId}`)
      await upsertOrderByStatus({
        partitionKey: to,
        rowKey: `${order.createdAt}_${orderId}`,
        orderId,
        userEmail: order.partitionKey,
        customerName: order.customerName,
        displayTotal: order.displayTotal,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
        updatedAt: now,
      })
    } catch (indexErr) {
      // Non-fatal - nightly reconciliation will fix drift.
      context.warn('ordersByStatus index update failed', indexErr)
    }

    // 3. Write event to audit log
    await appendOrderEvent({
      partitionKey: orderId,
      rowKey: `${now}_status`,
      fromStatus: from,
      toStatus: to,
      channel: 'status',
      by: admin.adminId,
      byRole: admin.role,
      note: body.note || `Status changed to ${statusLabel(to)}`,
      meta: JSON.stringify({
        tracking: body.tracking,
        courier: body.courier,
      }),
      createdAt: now,
    })

    // 4. Admin audit log
    await appendAuditLog({
      partitionKey: 'admin',
      rowKey: `${now}_${admin.adminId}`,
      staffId: admin.adminId,
      action: 'order.status.update',
      resourceType: 'order',
      resourceId: orderId,
      details: JSON.stringify({ from, to }),
      createdAt: now,
    })

    // 5. Enqueue customer notification if requested
    if (body.notifyCustomer !== false && order.customerEmail) {
      const notifications = getTransitionNotifications(to)
      for (const channel of notifications.customer) {
        await enqueueNotification({
          userEmail: order.customerEmail,
          channel,
          templateKey: `order_${to.toLowerCase()}`,
          vars: {
            customerName: order.customerName,
            orderId,
            status: statusLabel(to),
            tracking: body.tracking || '',
            courier: body.courier || '',
          },
        })
      }
    }

    return jsonResponse(
      {
        ok: true,
        order: { id: orderId, status: to, updatedAt: now },
        nextStates: nextValidStates(to).map((s) => ({
          status: s,
          label: statusLabel(s),
        })),
      },
      200,
      {},
      origin,
    )
  } catch (err) {
    context.error('adminUpdateStatus failed', err)
    return errorResponse('Failed to update status', 500, origin)
  }
}

// ─── POST /api/admin/orders/{id}/notes ───────────────────────

async function adminAddNote(
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

    const body = (await request.json()) as { note: string }
    if (!body.note?.trim()) return errorResponse('Note is required', 400, origin)

    const now = new Date().toISOString()
    await appendOrderEvent({
      partitionKey: orderId,
      rowKey: `${now}_note`,
      channel: 'internal',
      by: admin.adminId,
      byRole: admin.role,
      note: body.note.trim(),
      createdAt: now,
    })

    return jsonResponse({ ok: true }, 201, {}, origin)
  } catch (err) {
    context.error('adminAddNote failed', err)
    return errorResponse('Failed to add note', 500, origin)
  }
}

// NOTE: a standalone `GET /api/admin/orders/{id}/events` previously lived
// here. It returned exactly the same events array that adminGetOrder
// already embeds in its response, so every admin caller used the
// embedded copy and the standalone route was dead. Removed on 2026-05-31
// to prevent drift (two places returning events meant a future change
// could leave them shaped differently). If a future feature needs events
// without the rest of the order, restore from git history.

// ─── PATCH /api/admin/orders/bulk-status ─────────────────────

async function adminBulkStatus(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)
  const csrfFail = enforceCsrf(request, origin)
  if (csrfFail) return csrfFail

  const admin = requireAdmin(request)
  if (!admin) return errorResponse('Unauthorized', 401, origin)

  try {
    const body = (await request.json()) as {
      ids: string[]
      to: string
      note?: string
      notifyCustomer?: boolean
    }

    if (!body.ids?.length) return errorResponse('No order IDs provided', 400, origin)
    if (!body.to || !isValidStatus(body.to)) {
      return errorResponse(`Invalid target status: ${body.to}`, 400, origin)
    }

    const to = body.to as OrderStatus
    const results: { id: string; ok: boolean; error?: string }[] = []

    for (const id of body.ids) {
      try {
        const order = await getOrderById(id)
        if (!order) {
          results.push({ id, ok: false, error: 'Not found' })
          continue
        }
        if (!canTransition(order.status as OrderStatus, to)) {
          results.push({ id, ok: false, error: `Cannot transition from ${order.status}` })
          continue
        }

        const now = new Date().toISOString()
        await mergeOrder(order.partitionKey, id, { status: to, updatedAt: now })
        await appendOrderEvent({
          partitionKey: id,
          rowKey: `${now}_bulk`,
          fromStatus: order.status,
          toStatus: to,
          channel: 'status',
          by: admin.adminId,
          byRole: admin.role,
          note: body.note || `Bulk status change to ${statusLabel(to)}`,
          createdAt: now,
        })

        results.push({ id, ok: true })
      } catch (err) {
        results.push({ id, ok: false, error: 'Internal error' })
      }
    }

    return jsonResponse({ results }, 200, {}, origin)
  } catch (err) {
    context.error('adminBulkStatus failed', err)
    return errorResponse('Bulk operation failed', 500, origin)
  }
}

// ─── POST /api/admin/orders/{id}/return/decline ──────────────
// Admin rejects a return request. State machine allows
// RETURN_REQUESTED -> DELIVERED specifically for this case.

async function adminDeclineReturn(
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
    if (order.status !== 'RETURN_REQUESTED') {
      return errorResponse(
        `Cannot decline a return for an order in "${order.status}" status`,
        400,
        origin,
      )
    }

    const body = (await request.json()) as { reason?: string; notifyCustomer?: boolean }
    const reason = (body.reason || '').trim()
    if (!reason || reason.length > 500) {
      return errorResponse('Decline reason is required (1-500 characters)', 400, origin)
    }

    const now = new Date().toISOString()

    await mergeOrder(order.partitionKey, orderId, {
      status: 'DELIVERED',
      returnDeclineReason: reason,
      updatedAt: now,
    })

    // Move the secondary index back to the previous bucket
    try {
      await deleteOrderByStatus('RETURN_REQUESTED', `${order.createdAt}_${orderId}`)
      await upsertOrderByStatus({
        partitionKey: 'DELIVERED',
        rowKey: `${order.createdAt}_${orderId}`,
        orderId,
        userEmail: order.partitionKey,
        customerName: order.customerName,
        displayTotal: order.displayTotal,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
        updatedAt: now,
      })
    } catch (indexErr) {
      context.warn('ordersByStatus index update failed', indexErr)
    }

    await appendOrderEvent({
      partitionKey: orderId,
      rowKey: `${now}_return_declined`,
      fromStatus: 'RETURN_REQUESTED',
      toStatus: 'DELIVERED',
      channel: 'status',
      by: admin.adminId,
      byRole: admin.role,
      note: `Return declined: ${reason}`,
      createdAt: now,
    })

    await appendAuditLog({
      partitionKey: 'admin',
      rowKey: `${now}_${admin.adminId}`,
      staffId: admin.adminId,
      action: 'order.return.decline',
      resourceType: 'order',
      resourceId: orderId,
      details: JSON.stringify({ reason }),
      createdAt: now,
    })

    if (body.notifyCustomer !== false && order.customerEmail) {
      try {
        await enqueueNotification({
          userEmail: order.customerEmail,
          channel: 'email',
          templateKey: 'return_declined',
          vars: {
            customerName: order.customerName,
            orderId,
            reason,
          },
        })
      } catch (notifyErr) {
        context.warn('adminDeclineReturn: notification enqueue failed (non-fatal)', notifyErr)
      }
    }

    return jsonResponse({ ok: true, status: 'DELIVERED', reason }, 200, {}, origin)
  } catch (err) {
    if (err instanceof SyntaxError) return errorResponse('Invalid request body', 400, origin)
    context.error('adminDeclineReturn failed', err)
    return errorResponse('Failed to decline return', 500, origin)
  }
}

// ─── Route registrations ─────────────────────────────────────

app.http('adminListOrders', {
  methods: ['GET', 'OPTIONS'],
  route: 'api/admin/orders',
  authLevel: 'anonymous',
  handler: adminListOrders,
})

app.http('adminGetOrder', {
  methods: ['GET', 'OPTIONS'],
  route: 'api/admin/orders/{id}',
  authLevel: 'anonymous',
  handler: adminGetOrder,
})

app.http('adminUpdateStatus', {
  methods: ['PATCH', 'OPTIONS'],
  route: 'api/admin/orders/{id}/status',
  authLevel: 'anonymous',
  handler: adminUpdateStatus,
})

app.http('adminAddNote', {
  methods: ['POST', 'OPTIONS'],
  route: 'api/admin/orders/{id}/notes',
  authLevel: 'anonymous',
  handler: adminAddNote,
})

app.http('adminBulkStatus', {
  methods: ['PATCH', 'OPTIONS'],
  route: 'api/admin/orders/bulk-status',
  authLevel: 'anonymous',
  handler: adminBulkStatus,
})

app.http('adminDeclineReturn', {
  methods: ['POST', 'OPTIONS'],
  route: 'api/admin/orders/{id}/return/decline',
  authLevel: 'anonymous',
  handler: adminDeclineReturn,
})
