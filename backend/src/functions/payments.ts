/**
 * Razorpay Payment Endpoints
 *
 *   POST /api/razorpay/create-order   — server-priced, creates internal + razorpay orders
 *   POST /api/razorpay/verify          — signature check after Checkout closes
 *   POST /api/razorpay/webhook         — async backup (Razorpay → us), HMAC-verified
 *
 * The webhook path is in csrfGuard's SKIP_PATHS — it's signature-verified
 * out-of-band so CSRF does not apply. The other two routes are CSRF-checked
 * via the normal enforceCsrf path.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { randomBytes } from 'crypto'
import {
  createRazorpayOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  isRazorpayConfigured,
  getPublicKeyId,
} from '../services/razorpay'
import {
  createOrder,
  createOrderItem,
  appendOrderEvent,
  upsertOrderByStatus,
  deleteOrderByStatus,
  getProductById,
  getOrderById,
  getAllOrders,
  mergeOrder,
  Row,
} from '../services/tableStorage'
import { requireUser } from '../middleware/userGuard'
import { enforceCsrf } from '../middleware/csrfGuard'
import { jsonResponse, errorResponse, corsPreflightResponse } from '../utils/response'
import { canTransition } from '../services/orderState'
import { enqueueNotification } from '../services/queue'
import { getShippingConfig, computeShippingAmount } from '../services/shippingConfig'
import type { OrderItemSnapshot, OrderStatus } from '../types'

function generateOrderId(): string {
  const year = new Date().getFullYear()
  const seq = randomBytes(5).toString('hex').toUpperCase()
  return `TSA-${year}-${seq}`
}

// ─── POST /api/razorpay/create-order ─────────────────────────

async function createPaymentOrder(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)
  const csrfFail = enforceCsrf(request, origin)
  if (csrfFail) return csrfFail

  if (!isRazorpayConfigured()) {
    context.error('createPaymentOrder: Razorpay env vars not configured')
    return errorResponse('Payment gateway is not available', 503, origin)
  }

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

    const internalOrderId = generateOrderId()
    const now = new Date().toISOString()
    const email = body.customerEmail?.toLowerCase() || (userEmail !== 'guest' ? userEmail : '')

    // 1. Create the Razorpay order FIRST. If this fails we haven't yet
    //    persisted our internal order, so there's no orphan to clean up.
    let rzpOrder
    try {
      rzpOrder = await createRazorpayOrder({
        amountPaise: totalAmount,
        currency: 'INR',
        receipt: internalOrderId,
        notes: {
          internalOrderId,
          userEmail,
          customerName: body.customerName.slice(0, 50),
        },
      })
    } catch (err) {
      context.error('createPaymentOrder: razorpay order creation failed', err)
      return errorResponse('Could not initiate payment. Please try again.', 502, origin)
    }

    const orderRow: Row = {
      partitionKey: userEmail,
      rowKey: internalOrderId,
      status: 'PLACED',
      paymentStatus: 'PENDING',
      items: JSON.stringify(itemSnapshots),
      totalAmount,
      displayTotal,
      subtotal,
      shippingAmount,
      discountAmount: 0,
      couponCode: body.couponCode || '',
      customerName: body.customerName,
      customerEmail: email,
      customerPhone: body.customerPhone,
      shippingAddress: JSON.stringify(body.shippingAddress),
      customerNote: body.customerNote || '',
      addressEdited: false,
      razorpayOrderId: rzpOrder.id,
      createdAt: now,
      updatedAt: now,
    }

    await createOrder(orderRow)

    for (const snap of itemSnapshots) {
      await createOrderItem({
        partitionKey: internalOrderId,
        rowKey: snap.productId,
        ...snap,
      })
    }

    await appendOrderEvent({
      partitionKey: internalOrderId,
      rowKey: `${now}_001`,
      toStatus: 'PLACED',
      channel: 'status',
      by: userEmail,
      byRole: userEmail === 'guest' ? 'system' : 'customer',
      note: 'Order placed — awaiting payment',
      meta: JSON.stringify({ razorpayOrderId: rzpOrder.id }),
      createdAt: now,
    })

    await upsertOrderByStatus({
      partitionKey: 'PLACED',
      rowKey: `${now}_${internalOrderId}`,
      orderId: internalOrderId,
      userEmail,
      customerName: body.customerName,
      displayTotal,
      paymentStatus: 'PENDING',
      createdAt: now,
      updatedAt: now,
    })

    return jsonResponse(
      {
        order: {
          id: internalOrderId,
          razorpayOrderId: rzpOrder.id,
          amount: totalAmount,           // paise — what Razorpay Checkout expects
          displayTotal,
          currency: rzpOrder.currency || 'INR',
          customerName: body.customerName,
          customerEmail: email,
          customerPhone: body.customerPhone,
        },
        // Public key id is safe to expose — it's literally rendered in the
        // browser when Checkout opens.
        keyId: getPublicKeyId(),
      },
      201,
      {},
      origin,
    )
  } catch (err) {
    if (err instanceof SyntaxError) {
      return errorResponse('Invalid request body', 400, origin)
    }
    context.error('createPaymentOrder: unexpected error', err)
    return errorResponse('Failed to create order', 500, origin)
  }
}

// ─── POST /api/razorpay/verify ───────────────────────────────

async function verifyPayment(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)
  const csrfFail = enforceCsrf(request, origin)
  if (csrfFail) return csrfFail

  try {
    const body = (await request.json()) as {
      razorpayOrderId?: string
      razorpayPaymentId?: string
      razorpaySignature?: string
      internalOrderId?: string
    }

    if (!body.razorpayOrderId || !body.razorpayPaymentId || !body.razorpaySignature) {
      return errorResponse('razorpayOrderId, razorpayPaymentId and razorpaySignature are required', 400, origin)
    }

    const ok = verifyPaymentSignature({
      razorpayOrderId: body.razorpayOrderId,
      razorpayPaymentId: body.razorpayPaymentId,
      razorpaySignature: body.razorpaySignature,
    })
    if (!ok) {
      context.warn(`verifyPayment: signature mismatch for razorpayOrderId=${body.razorpayOrderId}`)
      return errorResponse('Payment signature verification failed', 400, origin)
    }

    // Find our internal order. Prefer the client-supplied id (1-row lookup),
    // fall back to a scan-by-razorpayOrderId since the partition key (user
    // email) isn't directly known from the Razorpay response.
    let order: Row | null = null
    if (body.internalOrderId) {
      order = await getOrderById(body.internalOrderId)
    }
    if (!order) {
      const candidates = await getAllOrders()
      order = candidates.find((o) => o.razorpayOrderId === body.razorpayOrderId) || null
    }
    if (!order) {
      // The webhook will reconcile if this transient miss is real; tell the
      // user it succeeded but couldn't be confirmed yet.
      context.warn(`verifyPayment: no internal order matched razorpayOrderId=${body.razorpayOrderId}`)
      return jsonResponse(
        { ok: true, message: 'Payment received — your order will be confirmed shortly.' },
        202,
        {},
        origin,
      )
    }

    // Idempotency: if we already captured this payment, return success
    // without re-running side-effects.
    if (order.paymentStatus === 'CAPTURED' && order.razorpayPaymentId === body.razorpayPaymentId) {
      return jsonResponse({ ok: true, orderId: order.rowKey, alreadyVerified: true }, 200, {}, origin)
    }

    const now = new Date().toISOString()
    const fromStatus = order.status as OrderStatus
    const toStatus: OrderStatus = canTransition(fromStatus, 'CONFIRMED') ? 'CONFIRMED' : fromStatus

    await mergeOrder(order.partitionKey, order.rowKey, {
      paymentStatus: 'CAPTURED',
      razorpayPaymentId: body.razorpayPaymentId,
      status: toStatus,
      updatedAt: now,
    })

    await appendOrderEvent({
      partitionKey: order.rowKey,
      rowKey: `${now}_pay`,
      fromStatus,
      toStatus,
      channel: 'status',
      by: 'razorpay',
      byRole: 'system',
      note: 'Payment captured',
      meta: JSON.stringify({
        razorpayOrderId: body.razorpayOrderId,
        razorpayPaymentId: body.razorpayPaymentId,
      }),
      createdAt: now,
    })

    if (toStatus !== fromStatus) {
      try {
        await deleteOrderByStatus(fromStatus, `${order.createdAt}_${order.rowKey}`)
        await upsertOrderByStatus({
          partitionKey: toStatus,
          rowKey: `${order.createdAt}_${order.rowKey}`,
          orderId: order.rowKey,
          userEmail: order.partitionKey,
          customerName: order.customerName,
          displayTotal: order.displayTotal,
          paymentStatus: 'CAPTURED',
          createdAt: order.createdAt,
          updatedAt: now,
        })
      } catch (indexErr) {
        // Non-fatal — nightly reconciliation will fix drift.
        context.warn('verifyPayment: ordersByStatus index update failed', indexErr)
      }
    }

    if (order.customerEmail) {
      try {
        await enqueueNotification({
          userEmail: order.customerEmail,
          channel: 'email',
          templateKey: 'order_confirmed',
          vars: {
            customerName: order.customerName,
            orderId: order.rowKey,
          },
        })
      } catch (notifyErr) {
        context.warn('verifyPayment: notification enqueue failed (non-fatal)', notifyErr)
      }
    }

    return jsonResponse({ ok: true, orderId: order.rowKey, status: toStatus }, 200, {}, origin)
  } catch (err) {
    if (err instanceof SyntaxError) {
      return errorResponse('Invalid request body', 400, origin)
    }
    context.error('verifyPayment: unexpected error', err)
    return errorResponse('Verification failed', 500, origin)
  }
}

// ─── POST /api/razorpay/webhook ──────────────────────────────

async function razorpayWebhook(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  // Webhooks are signature-verified; OPTIONS / CSRF / origin are not
  // applicable. Razorpay POSTs directly server-to-server.

  const rawBody = await request.text()
  const signature =
    request.headers.get('x-razorpay-signature') ||
    request.headers.get('X-Razorpay-Signature') ||
    ''

  if (!verifyWebhookSignature(rawBody, signature)) {
    context.warn('razorpayWebhook: signature mismatch')
    return { status: 400, body: 'Bad signature' }
  }

  // Razorpay envelope shape varies by event family. Payment events expose
  // payload.payment.entity; refund events expose both payload.refund.entity
  // AND payload.payment.entity (so we can still find our order via the
  // parent payment's order_id).
  let payload: {
    event?: string
    payload?: {
      payment?: {
        entity?: {
          id?: string
          order_id?: string
          status?: string
          amount?: number
          method?: string
          email?: string
          contact?: string
        }
      }
      refund?: {
        entity?: {
          id?: string
          payment_id?: string
          amount?: number
          currency?: string
          status?: string
          speed_processed?: string
          notes?: Record<string, string>
        }
      }
    }
  }
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return { status: 400, body: 'Bad JSON' }
  }

  const event = payload.event
  const paymentEntity = payload.payload?.payment?.entity
  const refundEntity = payload.payload?.refund?.entity
  if (!event) {
    return { status: 200, body: 'ignored — no event' }
  }

  const razorpayOrderId = paymentEntity?.order_id
  const razorpayPaymentId = paymentEntity?.id || refundEntity?.payment_id

  // We need either an order_id (payment events) or a payment_id (refund
  // events) to locate our internal order. Anything else we can't act on.
  if (!razorpayOrderId && !razorpayPaymentId) {
    return { status: 200, body: 'ignored — no order/payment id' }
  }

  // Lookup our internal order. Today: full table scan.
  // TODO: add an ordersByRazorpayId secondary index when volume grows.
  const orders = await getAllOrders()
  const order = orders.find((o) =>
    (razorpayOrderId && o.razorpayOrderId === razorpayOrderId) ||
    (razorpayPaymentId && o.razorpayPaymentId === razorpayPaymentId),
  )
  if (!order) {
    context.warn(`razorpayWebhook: no internal order matched (event=${event}, orderId=${razorpayOrderId}, paymentId=${razorpayPaymentId})`)
    return { status: 200, body: 'ignored — unknown order' }
  }

  // Payment idempotency: if we already captured this payment id and the
  // incoming event is a payment.captured, no-op.
  if (
    event === 'payment.captured' &&
    order.paymentStatus === 'CAPTURED' &&
    order.razorpayPaymentId === razorpayPaymentId
  ) {
    return { status: 200, body: 'ok — already captured' }
  }
  // Refund idempotency: if we already stamped this exact refund id, no-op.
  if (
    (event === 'refund.processed' || event === 'refund.failed') &&
    refundEntity?.id &&
    order.razorpayRefundId === refundEntity.id &&
    order.status === 'REFUNDED'
  ) {
    return { status: 200, body: 'ok — refund already recorded' }
  }

  const now = new Date().toISOString()

  if (event === 'payment.captured' && paymentEntity) {
    const entity = paymentEntity
    const fromStatus = order.status as OrderStatus
    const toStatus: OrderStatus = canTransition(fromStatus, 'CONFIRMED') ? 'CONFIRMED' : fromStatus

    await mergeOrder(order.partitionKey, order.rowKey, {
      paymentStatus: 'CAPTURED',
      razorpayPaymentId,
      status: toStatus,
      updatedAt: now,
    })

    await appendOrderEvent({
      partitionKey: order.rowKey,
      rowKey: `${now}_webhook_captured`,
      fromStatus,
      toStatus,
      channel: 'status',
      by: 'razorpay-webhook',
      byRole: 'system',
      note: 'Payment captured (webhook)',
      meta: JSON.stringify({ razorpayOrderId, razorpayPaymentId, method: entity.method }),
      createdAt: now,
    })

    if (toStatus !== fromStatus) {
      try {
        await deleteOrderByStatus(fromStatus, `${order.createdAt}_${order.rowKey}`)
        await upsertOrderByStatus({
          partitionKey: toStatus,
          rowKey: `${order.createdAt}_${order.rowKey}`,
          orderId: order.rowKey,
          userEmail: order.partitionKey,
          customerName: order.customerName,
          displayTotal: order.displayTotal,
          paymentStatus: 'CAPTURED',
          createdAt: order.createdAt,
          updatedAt: now,
        })
      } catch (indexErr) {
        context.warn('razorpayWebhook: ordersByStatus index update failed', indexErr)
      }
    }

    return { status: 200, body: 'ok' }
  }

  if (event === 'payment.failed' && paymentEntity) {
    await mergeOrder(order.partitionKey, order.rowKey, {
      paymentStatus: 'FAILED',
      razorpayPaymentId,
      updatedAt: now,
    })

    await appendOrderEvent({
      partitionKey: order.rowKey,
      rowKey: `${now}_webhook_failed`,
      channel: 'status',
      by: 'razorpay-webhook',
      byRole: 'system',
      note: 'Payment failed (webhook)',
      meta: JSON.stringify({ razorpayOrderId, razorpayPaymentId }),
      createdAt: now,
    })

    return { status: 200, body: 'ok' }
  }

  // ── Refund events ────────────────────────────────────────────
  // refund.processed = money is back on customer's card/UPI.
  // refund.failed    = Razorpay couldn't process the refund.
  //
  // For BOTH events we keep the order's REFUNDED state intact if it was
  // already set by the admin's REFUNDED transition (which initiated the
  // refund). The webhook's job is to stamp the timestamp + refund id and
  // flip the paymentStatus to REFUNDED definitively.

  if (event === 'refund.processed' && refundEntity) {
    const fromStatus = order.status as OrderStatus
    const toStatus: OrderStatus = canTransition(fromStatus, 'REFUNDED') ? 'REFUNDED' : fromStatus

    await mergeOrder(order.partitionKey, order.rowKey, {
      paymentStatus: 'REFUNDED',
      razorpayRefundId: refundEntity.id || order.razorpayRefundId,
      refundAmount: refundEntity.amount ?? order.refundAmount,
      refundedAt: order.refundedAt || now,
      status: toStatus,
      // Clear any prior failure note now that the refund completed.
      refundFailureReason: '',
      updatedAt: now,
    })

    await appendOrderEvent({
      partitionKey: order.rowKey,
      rowKey: `${now}_refund_processed`,
      fromStatus,
      toStatus,
      channel: 'status',
      by: 'razorpay-webhook',
      byRole: 'system',
      note: `Refund processed (₹${((refundEntity.amount ?? 0) / 100).toFixed(2)})`,
      meta: JSON.stringify({
        razorpayRefundId: refundEntity.id,
        razorpayPaymentId,
        amountPaise: refundEntity.amount,
        speed: refundEntity.speed_processed,
      }),
      createdAt: now,
    })

    if (toStatus !== fromStatus) {
      try {
        await deleteOrderByStatus(fromStatus, `${order.createdAt}_${order.rowKey}`)
        await upsertOrderByStatus({
          partitionKey: toStatus,
          rowKey: `${order.createdAt}_${order.rowKey}`,
          orderId: order.rowKey,
          userEmail: order.partitionKey,
          customerName: order.customerName,
          displayTotal: order.displayTotal,
          paymentStatus: 'REFUNDED',
          createdAt: order.createdAt,
          updatedAt: now,
        })
      } catch (indexErr) {
        context.warn('razorpayWebhook(refund.processed): ordersByStatus index update failed', indexErr)
      }
    }

    if (order.customerEmail) {
      try {
        await enqueueNotification({
          userEmail: order.customerEmail,
          channel: 'email',
          templateKey: 'refund_processed',
          vars: {
            customerName: order.customerName,
            orderId: order.rowKey,
            amount: ((refundEntity.amount ?? 0) / 100).toFixed(2),
          },
        })
      } catch (notifyErr) {
        context.warn('razorpayWebhook(refund.processed): notification enqueue failed (non-fatal)', notifyErr)
      }
    }

    return { status: 200, body: 'ok — refund processed' }
  }

  if (event === 'refund.failed' && refundEntity) {
    const failureNote = `Razorpay refund failed (refund=${refundEntity.id || 'unknown'})`

    await mergeOrder(order.partitionKey, order.rowKey, {
      refundFailureReason: failureNote,
      updatedAt: now,
    })

    await appendOrderEvent({
      partitionKey: order.rowKey,
      rowKey: `${now}_refund_failed`,
      channel: 'internal',
      by: 'razorpay-webhook',
      byRole: 'system',
      note: failureNote,
      meta: JSON.stringify({
        razorpayRefundId: refundEntity.id,
        razorpayPaymentId,
        amountPaise: refundEntity.amount,
      }),
      createdAt: now,
    })

    return { status: 200, body: 'ok — refund failure recorded' }
  }

  // Anything else (refund.created, payment.authorized, settlement.*, etc.)
  // — accept and log. Razorpay only retries non-2xx responses, so we want
  // to return 200 here even though we don't act on the payload.
  return { status: 200, body: `ok — ignored event ${event}` }
}

// ─── Route registrations ─────────────────────────────────────

app.http('createPaymentOrder', {
  methods: ['POST', 'OPTIONS'],
  route: 'api/razorpay/create-order',
  authLevel: 'anonymous',
  handler: createPaymentOrder,
})

app.http('verifyPayment', {
  methods: ['POST', 'OPTIONS'],
  route: 'api/razorpay/verify',
  authLevel: 'anonymous',
  handler: verifyPayment,
})

app.http('razorpayWebhook', {
  methods: ['POST'],
  route: 'api/razorpay/webhook',
  authLevel: 'anonymous',
  handler: razorpayWebhook,
})
