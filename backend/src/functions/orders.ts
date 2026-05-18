/**
 * Customer Order Endpoints (§4.1).
 *
 * POST   /api/orders          — create order
 * GET    /api/my-orders       — list user's orders (renamed from /orders/me to avoid route conflict)
 * GET    /api/orders/{id}     — owner OR admin
 * GET    /api/orders/{id}/events — owner timeline
 * POST   /api/orders/{id}/cancel
 * PATCH  /api/orders/{id}/address
 * POST   /api/orders/{id}/issue
 * POST   /api/orders/{id}/return
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import {
  createOrder,
  createOrderItem,
  getOrderByOwner,
  getOrderById,
  getOrdersByUser,
  getOrderItems,
  getOrderEvents,
  appendOrderEvent,
  mergeOrder,
  upsertOrderByStatus,
  getProductById,
  Row,
} from '../services/tableStorage'
import { requireUser } from '../middleware/userGuard'
import { requireAdmin } from '../middleware/adminGuard'
import { enforceCsrf } from '../middleware/csrfGuard'
import { jsonResponse, errorResponse, corsPreflightResponse } from '../utils/response'
import { canCustomerCancel, canCustomerReturn } from '../services/orderState'
import { getShippingConfig, computeShippingAmount } from '../services/shippingConfig'
import {
  isValidReturnReason,
  type OrderStatus,
  type OrderItemSnapshot,
  type ReturnReasonCode,
} from '../types'
import { randomBytes } from 'crypto'

// Photo URLs on return requests must live on our own blob domain — same
// rule we apply to review photos. Stops customers (or scripted clients)
// from pointing us at javascript:/data:/external URLs.
function sanitiseReturnPhotos(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const allowedHost = (() => {
    const base = process.env.BLOB_BASE_URL
    if (!base) return null
    try { return new URL(base).hostname.toLowerCase() } catch { return null }
  })()
  return input
    .filter((u): u is string => typeof u === 'string')
    .map((u) => u.trim())
    .filter((u) => {
      try {
        const parsed = new URL(u)
        if (parsed.protocol !== 'https:') return false
        if (allowedHost && parsed.hostname.toLowerCase() !== allowedHost) return false
        return true
      } catch {
        return false
      }
    })
    .slice(0, 6)
}

// 5-digit Math.random() collision space was 100K — a year of orders would
// have measurable collisions, and an attacker could simply guess IDs.
// Switch to crypto.randomBytes for 10 hex chars of entropy.
function generateOrderId(): string {
  const year = new Date().getFullYear()
  const seq = randomBytes(5).toString('hex').toUpperCase()
  return `TSA-${year}-${seq}`
}

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
    invoiceUrl: row.invoiceUrl || undefined,
    customerNote: row.customerNote || undefined,
    // Return / refund metadata — exposed so the account page can render
    // the right "in progress" / "approved" / "declined" / "refunded" UI.
    returnRequestedAt: row.returnRequestedAt || undefined,
    returnReason: row.returnReason || undefined,
    returnComment: row.returnComment || undefined,
    returnPhotos: safeJson(row.returnPhotos) || [],
    returnDeclineReason: row.returnDeclineReason || undefined,
    refundedAt: row.refundedAt || undefined,
    refundAmount: row.refundAmount ?? undefined,
    razorpayPaymentId: row.razorpayPaymentId || undefined,
    razorpayRefundId: row.razorpayRefundId || undefined,
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

// ─── POST /api/orders ────────────────────────────────────────

async function createNewOrder(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)
  const csrfFail = enforceCsrf(request, origin)
  if (csrfFail) return csrfFail

  try {
    const user = requireUser(request)
    const userEmail = user?.userId || 'guest'

    const body = (await request.json()) as {
      items: { productId: string; qty: number }[]
      shippingAddress: Record<string, string>
      customerName: string
      customerPhone: string
      customerEmail?: string
      customerNote?: string
      couponCode?: string
    }

    if (!body.items?.length) return errorResponse('At least one item is required', 400, origin)
    if (!body.shippingAddress) return errorResponse('Shipping address is required', 400, origin)
    if (!body.customerName) return errorResponse('Customer name is required', 400, origin)
    if (!body.customerPhone) return errorResponse('Phone number is required', 400, origin)

    // Validate item quantities before any storage calls.
    for (const item of body.items) {
      if (!Number.isInteger(item.qty) || item.qty < 1 || item.qty > 100) {
        return errorResponse('Each item quantity must be a whole number between 1 and 100', 400, origin)
      }
    }

    // Authoritative price lookup — never trust client-side prices (§13).
    let subtotal = 0
    const itemSnapshots: OrderItemSnapshot[] = []

    for (const item of body.items) {
      const product = await getProductById(item.productId)
      if (!product) return errorResponse(`Product ${item.productId} not found`, 400, origin)
      if (!product.inStock) return errorResponse(`${product.title} is out of stock`, 400, origin)
      if (product.stockQty != null && product.stockQty < item.qty) {
        return errorResponse(`Only ${product.stockQty} units of ${product.title} available`, 400, origin)
      }

      const price = product.price || (product.displayPrice ?? 0) * 100
      subtotal += price * item.qty

      itemSnapshots.push({
        productId: item.productId,
        title: product.title,
        category: product.partitionKey,
        imageUrl: product.imageUrl,
        price,
        displayPrice: product.displayPrice ?? price / 100,
        qty: item.qty,
      })
    }

    // Shipping is admin-configurable via /admin/settings. computeShippingAmount
    // applies the free-threshold and the effective (possibly discounted) charge.
    const shippingCfg = await getShippingConfig()
    const shippingAmount = computeShippingAmount(subtotal, shippingCfg)
    const totalAmount = subtotal + shippingAmount
    const displayTotal = totalAmount / 100

    const orderId = generateOrderId()
    const now = new Date().toISOString()
    const email = body.customerEmail?.toLowerCase() || (userEmail !== 'guest' ? userEmail : '')

    const order: Row = {
      partitionKey: userEmail,
      rowKey: orderId,
      status: 'PLACED',
      paymentStatus: 'PENDING',
      items: JSON.stringify(itemSnapshots),
      totalAmount,
      displayTotal,
      subtotal,
      shippingAmount,
      discountAmount: 0,
      couponCode: '',
      customerName: body.customerName,
      customerEmail: email,
      customerPhone: body.customerPhone,
      shippingAddress: JSON.stringify(body.shippingAddress),
      customerNote: body.customerNote || '',
      addressEdited: false,
      createdAt: now,
      updatedAt: now,
    }

    await createOrder(order)

    // Write order items
    for (const snap of itemSnapshots) {
      await createOrderItem({
        partitionKey: orderId,
        rowKey: snap.productId,
        ...snap,
      })
    }

    // Write initial PLACED event
    await appendOrderEvent({
      partitionKey: orderId,
      rowKey: `${now}_001`,
      toStatus: 'PLACED',
      channel: 'status',
      by: userEmail,
      byRole: userEmail === 'guest' ? 'system' : 'customer',
      note: 'Order placed',
      createdAt: now,
    })

    // Add to secondary index
    await upsertOrderByStatus({
      partitionKey: 'PLACED',
      rowKey: `${now}_${orderId}`,
      orderId,
      userEmail,
      customerName: body.customerName,
      displayTotal,
      paymentStatus: 'PENDING',
      createdAt: now,
      updatedAt: now,
    })

    return jsonResponse({ order: toApi(order) }, 201, {}, origin)
  } catch (err) {
    context.error('createNewOrder failed', err)
    return errorResponse('Failed to create order', 500, origin)
  }
}

// ─── GET /api/orders/me ──────────────────────────────────────

async function listMyOrders(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)

  const user = requireUser(request)
  if (!user) return errorResponse('Authentication required', 401, origin)

  try {
    const rows = await getOrdersByUser(user.userId)
    return jsonResponse({ orders: rows.map(toApi) }, 200, {}, origin)
  } catch (err) {
    context.error('listMyOrders failed', err)
    return errorResponse('Failed to load orders', 500, origin)
  }
}

// ─── GET /api/orders/{id} ────────────────────────────────────

async function getOrderDetail(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)

  const orderId = request.params.id
  if (!orderId) return errorResponse('Missing order id', 400, origin)

  const user = requireUser(request)
  const admin = requireAdmin(request)

  if (!user && !admin) return errorResponse('Authentication required', 401, origin)

  try {
    let order: Row | null = null

    if (user) {
      order = await getOrderByOwner(user.userId, orderId)
    }
    if (!order && admin) {
      order = await getOrderById(orderId)
    }

    if (!order) return errorResponse('Order not found', 404, origin)

    const items = await getOrderItems(orderId)

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
      },
      200,
      {},
      origin,
    )
  } catch (err) {
    context.error('getOrderDetail failed', err)
    return errorResponse('Failed to load order', 500, origin)
  }
}

// ─── GET /api/orders/{id}/events ─────────────────────────────

async function getOrderTimeline(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)

  const orderId = request.params.id
  if (!orderId) return errorResponse('Missing order id', 400, origin)

  const user = requireUser(request)
  if (!user) return errorResponse('Authentication required', 401, origin)

  try {
    const order = await getOrderByOwner(user.userId, orderId)
    if (!order) return errorResponse('Order not found', 404, origin)

    // Customer sees only non-internal events
    const events = await getOrderEvents(orderId, false)
    return jsonResponse(
      {
        events: events.map((e) => ({
          status: e.toStatus,
          fromStatus: e.fromStatus || undefined,
          note: e.note || undefined,
          by: e.byRole === 'customer' ? 'You' : 'Srilatha Art',
          createdAt: e.createdAt,
        })),
      },
      200,
      {},
      origin,
    )
  } catch (err) {
    context.error('getOrderTimeline failed', err)
    return errorResponse('Failed to load timeline', 500, origin)
  }
}

// ─── POST /api/orders/{id}/cancel ────────────────────────────

async function cancelOrder(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)
  const csrfFail = enforceCsrf(request, origin)
  if (csrfFail) return csrfFail

  const orderId = request.params.id
  if (!orderId) return errorResponse('Missing order id', 400, origin)

  const user = requireUser(request)
  if (!user) return errorResponse('Authentication required', 401, origin)

  try {
    const order = await getOrderByOwner(user.userId, orderId)
    if (!order) return errorResponse('Order not found', 404, origin)

    if (!canCustomerCancel(order.status as OrderStatus)) {
      return errorResponse(
        `Cannot cancel an order in "${order.status}" status`,
        400,
        origin,
      )
    }

    const body = (await request.json()) as { reason?: string }
    if (!body.reason) return errorResponse('Cancel reason is required', 400, origin)

    const now = new Date().toISOString()
    await mergeOrder(user.userId, orderId, {
      status: 'CANCELLED',
      cancelReason: body.reason,
      updatedAt: now,
    })

    await appendOrderEvent({
      partitionKey: orderId,
      rowKey: `${now}_cancel`,
      fromStatus: order.status,
      toStatus: 'CANCELLED',
      channel: 'status',
      by: user.userId,
      byRole: 'customer',
      note: body.reason,
      createdAt: now,
    })

    return jsonResponse({ ok: true, status: 'CANCELLED' }, 200, {}, origin)
  } catch (err) {
    context.error('cancelOrder failed', err)
    return errorResponse('Failed to cancel order', 500, origin)
  }
}

// ─── PATCH /api/orders/{id}/address ──────────────────────────

async function updateOrderAddress(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)
  const csrfFail = enforceCsrf(request, origin)
  if (csrfFail) return csrfFail

  const orderId = request.params.id
  if (!orderId) return errorResponse('Missing order id', 400, origin)

  const user = requireUser(request)
  if (!user) return errorResponse('Authentication required', 401, origin)

  try {
    const order = await getOrderByOwner(user.userId, orderId)
    if (!order) return errorResponse('Order not found', 404, origin)

    if (order.status !== 'PLACED') {
      return errorResponse('Address can only be changed while order is PLACED', 400, origin)
    }
    if (order.addressEdited) {
      return errorResponse('Address has already been edited once for this order', 400, origin)
    }

    const body = (await request.json()) as { shippingAddress: Record<string, string> }
    if (!body.shippingAddress) return errorResponse('Shipping address is required', 400, origin)

    const now = new Date().toISOString()
    await mergeOrder(user.userId, orderId, {
      shippingAddress: JSON.stringify(body.shippingAddress),
      addressEdited: true,
      updatedAt: now,
    })

    await appendOrderEvent({
      partitionKey: orderId,
      rowKey: `${now}_addr`,
      channel: 'note',
      by: user.userId,
      byRole: 'customer',
      note: 'Shipping address updated',
      createdAt: now,
    })

    return jsonResponse({ ok: true }, 200, {}, origin)
  } catch (err) {
    context.error('updateOrderAddress failed', err)
    return errorResponse('Failed to update address', 500, origin)
  }
}

// ─── POST /api/orders/{id}/return ────────────────────────────

async function requestReturn(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)
  const csrfFail = enforceCsrf(request, origin)
  if (csrfFail) return csrfFail

  const orderId = request.params.id
  if (!orderId) return errorResponse('Missing order id', 400, origin)

  const user = requireUser(request)
  if (!user) return errorResponse('Authentication required', 401, origin)

  try {
    const order = await getOrderByOwner(user.userId, orderId)
    if (!order) return errorResponse('Order not found', 404, origin)

    // Find the delivered event to check the return window
    const events = await getOrderEvents(orderId, false)
    const deliveredEvent = events.find((e) => e.toStatus === 'DELIVERED')

    if (!canCustomerReturn(order.status as OrderStatus, deliveredEvent?.createdAt)) {
      return errorResponse(
        'Returns are only allowed within 7 days of delivery',
        400,
        origin,
      )
    }

    const body = (await request.json()) as {
      reason?: ReturnReasonCode
      comment?: string
      photos?: string[]
    }
    if (!body.reason || !isValidReturnReason(body.reason)) {
      return errorResponse('A valid return reason is required', 400, origin)
    }
    const comment = typeof body.comment === 'string' ? body.comment.trim().slice(0, 1000) : ''
    // For "other", require some explanation so admin has context to act on.
    if (body.reason === 'other' && !comment) {
      return errorResponse('Please tell us a bit about the issue when choosing "Other"', 400, origin)
    }
    const photos = sanitiseReturnPhotos(body.photos)

    const now = new Date().toISOString()
    await mergeOrder(user.userId, orderId, {
      status: 'RETURN_REQUESTED',
      returnRequestedAt: now,
      returnReason: body.reason,
      returnComment: comment,
      returnPhotos: JSON.stringify(photos),
      updatedAt: now,
    })

    await appendOrderEvent({
      partitionKey: orderId,
      rowKey: `${now}_return`,
      fromStatus: 'DELIVERED',
      toStatus: 'RETURN_REQUESTED',
      channel: 'status',
      by: user.userId,
      byRole: 'customer',
      // Human-readable timeline entry combines the structured code + free text.
      note: comment ? `${body.reason}: ${comment}` : body.reason,
      meta: JSON.stringify({ reason: body.reason, comment, photos }),
      createdAt: now,
    })

    return jsonResponse(
      { ok: true, status: 'RETURN_REQUESTED', reason: body.reason },
      200,
      {},
      origin,
    )
  } catch (err) {
    context.error('requestReturn failed', err)
    return errorResponse('Failed to request return', 500, origin)
  }
}

// ─── Route registrations ─────────────────────────────────────

app.http('createNewOrder', {
  methods: ['POST', 'OPTIONS'],
  route: 'api/orders',
  authLevel: 'anonymous',
  handler: createNewOrder,
})

app.http('listMyOrders', {
  methods: ['GET', 'OPTIONS'],
  route: 'api/my-orders',          // avoid route conflict with api/orders/{id}
  authLevel: 'anonymous',
  handler: listMyOrders,
})

app.http('getOrderDetail', {
  methods: ['GET', 'OPTIONS'],
  route: 'api/orders/{id}',
  authLevel: 'anonymous',
  handler: getOrderDetail,
})

app.http('getOrderTimeline', {
  methods: ['GET', 'OPTIONS'],
  route: 'api/orders/{id}/events',
  authLevel: 'anonymous',
  handler: getOrderTimeline,
})

app.http('cancelOrder', {
  methods: ['POST', 'OPTIONS'],
  route: 'api/orders/{id}/cancel',
  authLevel: 'anonymous',
  handler: cancelOrder,
})

app.http('updateOrderAddress', {
  methods: ['PATCH', 'OPTIONS'],
  route: 'api/orders/{id}/address',
  authLevel: 'anonymous',
  handler: updateOrderAddress,
})

app.http('requestReturn', {
  methods: ['POST', 'OPTIONS'],
  route: 'api/orders/{id}/return',
  authLevel: 'anonymous',
  handler: requestReturn,
})
