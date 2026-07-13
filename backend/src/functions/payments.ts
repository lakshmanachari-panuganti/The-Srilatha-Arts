/**
 * Razorpay Payment Endpoints
 *
 *   POST /api/razorpay/create-order   - server-priced, creates internal + razorpay orders
 *   POST /api/razorpay/verify          - signature check after Checkout closes
 *   POST /api/razorpay/webhook         - async backup (Razorpay → us), HMAC-verified
 *
 * The webhook path is in csrfGuard's SKIP_PATHS - it's signature-verified
 * out-of-band so CSRF does not apply. The other two routes are CSRF-checked
 * via the normal enforceCsrf path.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import {
  createRazorpayOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  isRazorpayConfigured,
  getPublicKeyId,
  createRefund,
} from '../services/razorpay'
import { recordAlert } from '../services/notificationAlerts'
import {
  createOrder,
  createOrderItem,
  appendOrderEvent,
  upsertOrderByStatus,
  deleteOrderByStatus,
  getProductById,
  getOrderById,
  findOrderByRazorpayRefs,
  mergeOrder,
  reserveStock,
  restoreStock,
  InsufficientStockError,
  StockConcurrencyError,
  upsertOrderByRazorpayId,
  getInternalOrderIdByRazorpay,
  mergeRazorpayIndexPaymentId,
  Row,
} from '../services/tableStorage'
import { requireUser } from '../middleware/userGuard'
import { enforceCsrf } from '../middleware/csrfGuard'
import { jsonResponse, errorResponse, corsPreflightResponse } from '../utils/response'
import { canTransition } from '../services/orderState'
import { enqueueNotification } from '../services/queue'
import { trackEvent as trackTelemetry, trackException } from '../utils/telemetry'
import { getShippingConfig, computeShippingAmount } from '../services/shippingConfig'
import { generateOrderNumber } from '../services/orderNumber'
import { finalizeOrderAfterPayment } from '../services/orderFulfillment'
import { evaluateCoupon } from '../services/couponEvaluation'
import type { OrderItemSnapshot, OrderStatus } from '../types'

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

  // ── Reservation tracking, scoped to the entire request lifecycle ─
  // Declared OUTSIDE the try so the outer catch can run the compensating
  // restore if anything throws after we reserved. The closure mutates
  // both the array and its callers; we clear after a successful restore
  // so any nested rollback call doesn't double-decrement.
  const reservedItems: { productId: string; qty: number }[] = []
  const rollbackReservations = async (): Promise<void> => {
    if (reservedItems.length === 0) return
    const toRestore = reservedItems.splice(0, reservedItems.length)
    for (const r of toRestore) {
      try {
        await restoreStock(r.productId, r.qty)
      } catch (restoreErr) {
        context.error(
          `createPaymentOrder: compensating restoreStock failed for ${r.productId} qty=${r.qty}`,
          restoreErr,
        )
        // Don't throw - let remaining items try to restore, then rely on
        // the timer-triggered stale-reservation cleanup to catch leftovers.
      }
    }
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

    // Authoritative price lookup - never trust client-side prices (§13).
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

    // ── Reserve inventory (optimistic concurrency) ────────────────────
    // Decrement stockQty on every item BEFORE creating the Razorpay order.
    // A successful reserve guarantees the inventory is held for this order
    // through to payment capture. If anything below fails (Razorpay create,
    // internal order persistence) we restore in a compensating loop so
    // we never leave reserved-but-uncaptured stock.
    //
    // Concurrent purchases of a one-of-one product can race on the read+
    // write pair; reserveStock uses ETag optimistic concurrency to detect
    // and retry. After retries are exhausted we surface a clean
    // "just-sold" error to the customer.
    //
    // The compensating restore on failure runs orphan-safe: the timer-
    // triggered stale-reservation cleanup function sweeps PLACED+PENDING
    // orders older than the threshold and restores their stock within 10
    // minutes, covering anything the inline rollback misses.
    for (const snap of itemSnapshots) {
      try {
        await reserveStock(snap.productId, snap.qty)
        reservedItems.push({ productId: snap.productId, qty: snap.qty })
      } catch (err) {
        await rollbackReservations()
        if (err instanceof InsufficientStockError) {
          return errorResponse(err.message, 409, origin)
        }
        if (err instanceof StockConcurrencyError) {
          return errorResponse(
            `${snap.title} just sold - please refresh and try again.`,
            409,
            origin,
          )
        }
        context.error('createPaymentOrder: reserveStock failed', err)
        return errorResponse('Could not reserve inventory. Please try again.', 500, origin)
      }
    }

    // Shipping is admin-configurable via /admin/settings. computeShippingAmount
    // applies the free-threshold and the effective (possibly discounted) charge.
    const shippingCfg = await getShippingConfig()
    const baseShippingAmount = computeShippingAmount(subtotal, shippingCfg)

    // ── Coupon application ──────────────────────────────────────────
    // The cart UI shows a preview total using /coupons/validate, but
    // we must re-evaluate here against server-priced items so the
    // customer is charged what we calculated, not what the client claimed.
    // A coupon that fails revalidation (expired, used up, doesn't meet
    // min spend after server pricing) rolls inventory back and returns
    // a clear error so the user can remove or change the code.
    let discountAmount = 0
    let shippingDiscount = 0
    let appliedCouponCode = ''
    const rawCouponCode = (body.couponCode || '').trim()
    if (rawCouponCode) {
      const couponResult = await evaluateCoupon(
        rawCouponCode,
        itemSnapshots.map((s) => ({
          productId: s.productId,
          category: s.category,
          price: s.price,
          qty: s.qty,
        })),
        userEmail !== 'guest' ? userEmail : undefined,
        context,
      )
      if (!couponResult.valid) {
        await rollbackReservations()
        return errorResponse(couponResult.message, 400, origin)
      }
      appliedCouponCode = couponResult.code
      if (couponResult.appliedTo === 'shipping') {
        shippingDiscount = Math.min(couponResult.discountAmount, baseShippingAmount)
      } else {
        discountAmount = Math.min(couponResult.discountAmount, subtotal)
      }
    }

    const shippingAmount = Math.max(0, baseShippingAmount - shippingDiscount)
    const totalAmount = Math.max(0, subtotal - discountAmount) + shippingAmount
    const displayTotal = totalAmount / 100

    const internalOrderId = await generateOrderNumber()
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
      // Compensating restore: Razorpay never accepted the order so we
      // must give the inventory back to the catalog before responding.
      await rollbackReservations()
      // The thrown message from createRazorpayOrder follows the format:
      //   "[razorpay] order create failed (<status>): <description>"
      // Surface the description to the caller so the failure is diagnosable
      // from the browser (wrong keys, KYC, min-amount, etc.) instead of a
      // generic "try again" that hides the actual cause.
      const raw = err instanceof Error ? err.message : ''
      const match = raw.match(/\[razorpay\] order create failed \((\d+)\): ([\s\S]+)$/)
      const detail = match ? `${match[2].trim()} (upstream ${match[1]})` : ''
      const message = detail
        ? `Payment could not be started: ${detail}`
        : 'Could not initiate payment. Please try again.'
      return errorResponse(message, 502, origin)
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
      discountAmount: discountAmount + shippingDiscount,
      couponCode: appliedCouponCode,
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
      note: 'Order placed - awaiting payment',
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

    // Write the razorpayOrderId → internalOrderId index so verify + webhook
    // can point-lookup instead of scanning the whole orders table (audit H3).
    // Failure here is non-fatal - the scan fallback in verify/webhook still
    // works, we just pay O(n) instead of O(1). Log so ops can spot drift.
    try {
      await upsertOrderByRazorpayId(rzpOrder.id, internalOrderId, userEmail)
    } catch (indexErr) {
      context.warn('createPaymentOrder: ordersByRazorpayId upsert failed (falling back to scan on verify)', indexErr)
    }

    return jsonResponse(
      {
        order: {
          id: internalOrderId,
          razorpayOrderId: rzpOrder.id,
          amount: totalAmount,           // paise - what Razorpay Checkout expects
          displayTotal,
          currency: rzpOrder.currency || 'INR',
          customerName: body.customerName,
          customerEmail: email,
          customerPhone: body.customerPhone,
        },
        // Public key id is safe to expose - it's literally rendered in the
        // browser when Checkout opens.
        keyId: getPublicKeyId(),
      },
      201,
      {},
      origin,
    )
  } catch (err) {
    if (err instanceof SyntaxError) {
      await rollbackReservations()
      return errorResponse('Invalid request body', 400, origin)
    }
    context.error('createPaymentOrder: unexpected error', err)
    // Inline best-effort restore. If it itself throws or partially fails,
    // staleReservationCleanup will sweep anything left over.
    await rollbackReservations()
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

    // Best-effort: stamp the payment id onto the ordersByRazorpayId index
    // row so refund-only webhook events (which sometimes carry just a
    // payment id) can resolve via the index later. Non-fatal - the scan
    // fallback still covers a miss.
    try {
      await mergeRazorpayIndexPaymentId(body.razorpayOrderId, body.razorpayPaymentId)
    } catch (indexErr) {
      context.warn('verifyPayment: ordersByRazorpayId payment-id merge failed (non-fatal)', indexErr)
    }

    // Find our internal order. Preference order:
    //   1. Client-supplied internalOrderId (single-row lookup, hot path).
    //   2. Secondary index ordersByRazorpayId (audit H3 - point lookup).
    //   3. Full-table scan (last-resort fallback when the index misses,
    //      e.g. a legacy order created before the index was introduced).
    let order: Row | null = null
    if (body.internalOrderId) {
      order = await getOrderById(body.internalOrderId)
    }
    if (!order) {
      const indexed = await getInternalOrderIdByRazorpay(body.razorpayOrderId)
      if (indexed) {
        order = await getOrderById(indexed.internalOrderId)
      }
    }
    if (!order) {
      // Scan fallback - kept for legacy orders. Emit telemetry so a spike
      // in scan-usage signals the index write is misfiring.
      context.warn(`verifyPayment: falling back to scan for razorpayOrderId=${body.razorpayOrderId}`)
      order = await findOrderByRazorpayRefs(body.razorpayOrderId)
    }
    if (!order) {
      // The webhook will reconcile if this transient miss is real; tell the
      // user it succeeded but couldn't be confirmed yet.
      context.warn(`verifyPayment: no internal order matched razorpayOrderId=${body.razorpayOrderId}`)
      return jsonResponse(
        { ok: true, message: 'Payment received - your order will be confirmed shortly.' },
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

    // Captured-after-cancellation guard - same shape as the webhook
    // handler. If the order was cancelled by the stale-reservation
    // cleanup and the customer's Razorpay verify request lands later,
    // we auto-refund and skip the confirmation pipeline. See the webhook
    // handler below for the full rationale.
    if (fromStatus === 'CANCELLED') {
      let refundId: string | undefined
      let refundError: string | undefined
      try {
        const refund = await createRefund({
          paymentId: body.razorpayPaymentId,
          speed: 'normal',
          notes: {
            reason: 'auto-refund: payment captured after order cancellation',
            orderId: order.rowKey,
          },
        })
        refundId = refund.id
      } catch (err) {
        refundError = err instanceof Error ? err.message : String(err)
        context.error(
          `verifyPayment: auto-refund failed for orderId=${order.rowKey} paymentId=${body.razorpayPaymentId}`,
          err,
        )
      }

      await mergeOrder(order.partitionKey, order.rowKey, {
        razorpayPaymentId: body.razorpayPaymentId,
        paymentStatus: 'CAPTURED',
        paymentAfterCancel: true,
        autoRefundInitiated: Boolean(refundId),
        razorpayRefundId: refundId || (order.razorpayRefundId as string) || '',
        autoRefundError: refundError || '',
        updatedAt: now,
      })

      await appendOrderEvent({
        partitionKey: order.rowKey,
        rowKey: `${now}_verify_captured_after_cancel`,
        channel: 'status',
        by: 'razorpay-verify',
        byRole: 'system',
        note: refundId
          ? `Payment captured AFTER cancellation (verify path) - auto-refund initiated (refund ${refundId})`
          : `Payment captured AFTER cancellation (verify path) - auto-refund FAILED: ${refundError || 'unknown'}`,
        meta: JSON.stringify({
          razorpayOrderId: body.razorpayOrderId,
          razorpayPaymentId: body.razorpayPaymentId,
          refundId,
          refundError,
        }),
        createdAt: now,
      })

      await recordAlert({
        orderId: order.rowKey,
        channel: 'payment',
        operation: 'payment_after_cancel',
        customerName: (order.customerName as string) || '',
        customerContact:
          (order.customerEmail as string) || (order.customerPhone as string) || '',
        reason: refundId
          ? `Late payment received after order cancellation. Auto-refund initiated (refund id ${refundId}). Verify with Razorpay dashboard.`
          : `Late payment received after order cancellation. Auto-refund FAILED: ${refundError || 'unknown error'}. Manual refund required.`,
        attempt: 1,
        isFinal: true,
      })

      // The customer's Razorpay handler is awaiting this verify response.
      // Don't tell them "confirmed" - tell them something went sideways
      // and a refund is on the way. They'll get no confirmation messages.
      return jsonResponse(
        {
          ok: false,
          orderId: order.rowKey,
          status: 'cancelled',
          message:
            'Your order was cancelled before this payment arrived. A refund has been initiated and should reflect in your account within 5-7 business days.',
        },
        200,
        {},
        origin,
      )
    }

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
        // Non-fatal - nightly reconciliation will fix drift.
        context.warn('verifyPayment: ordersByStatus index update failed', indexErr)
      }
    }

    // Generate invoice + enqueue WhatsApp and email confirmations.
    // Idempotent - if the webhook beats us to it we'll see invoiceUrl
    // already set and short-circuit. Enqueue (not direct send) means
    // SMTP / WhatsApp failures don't block this response; the queue
    // consumer logs + retries them.
    try {
      const refreshed = {
        ...order,
        paymentStatus: 'CAPTURED',
        razorpayPaymentId: body.razorpayPaymentId,
        status: toStatus,
        updatedAt: now,
      }
      await finalizeOrderAfterPayment(refreshed, context)
    } catch (invErr) {
      // Don't block the verify response - the webhook will retry.
      context.error('verifyPayment: finalizeOrderAfterPayment failed', invErr)
      trackException(invErr, {
        stage: 'finalize_after_payment',
        orderId: order.rowKey,
        path: 'verify',
      })
    }

    trackTelemetry('payment.captured', {
      orderId: order.rowKey,
      amountPaise: order.totalAmount,
      method: 'razorpay',
      path: 'verify',
    })

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
    trackTelemetry('webhook.signature_failed', {
      source: 'razorpay',
      hasSignature: Boolean(signature),
    })
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
    return { status: 200, body: 'ignored - no event' }
  }

  const razorpayOrderId = paymentEntity?.order_id
  const razorpayPaymentId = paymentEntity?.id || refundEntity?.payment_id

  // We need either an order_id (payment events) or a payment_id (refund
  // events) to locate our internal order. Anything else we can't act on.
  if (!razorpayOrderId && !razorpayPaymentId) {
    return { status: 200, body: 'ignored - no order/payment id' }
  }

  // Lookup order. Prefer the ordersByRazorpayId secondary index (audit H3)
  // when we have a razorpayOrderId (payment events do; refund.processed
  // does via payload.payment.entity.order_id). Otherwise fall back to a
  // scan by razorpayPaymentId (refund events sometimes only supply that).
  let order: Row | null = null
  if (razorpayOrderId) {
    const indexed = await getInternalOrderIdByRazorpay(razorpayOrderId)
    if (indexed) {
      order = await getOrderById(indexed.internalOrderId)
    }
  }
  if (!order) {
    context.warn(`razorpayWebhook: index miss, scanning (event=${event}, orderId=${razorpayOrderId}, paymentId=${razorpayPaymentId})`)
    order = await findOrderByRazorpayRefs(razorpayOrderId, razorpayPaymentId)
  }
  if (!order) {
    context.warn(`razorpayWebhook: no internal order matched (event=${event}, orderId=${razorpayOrderId}, paymentId=${razorpayPaymentId})`)
    return { status: 200, body: 'ignored - unknown order' }
  }

  // Payment idempotency: if we already captured this payment id and the
  // incoming event is a payment.captured, no-op.
  if (
    event === 'payment.captured' &&
    order.paymentStatus === 'CAPTURED' &&
    order.razorpayPaymentId === razorpayPaymentId
  ) {
    return { status: 200, body: 'ok - already captured' }
  }
  // Refund idempotency: if we already stamped this exact refund id, no-op.
  if (
    (event === 'refund.processed' || event === 'refund.failed') &&
    refundEntity?.id &&
    order.razorpayRefundId === refundEntity.id &&
    order.status === 'REFUNDED'
  ) {
    return { status: 200, body: 'ok - refund already recorded' }
  }

  const now = new Date().toISOString()

  if (event === 'payment.captured' && paymentEntity) {
    const entity = paymentEntity
    const fromStatus = order.status as OrderStatus

    // ── Captured-after-cancellation race ────────────────────────────
    // The customer's order was cancelled (most commonly by the stale-
    // reservation cleanup at the 30-min mark) but their payment captured
    // arrives anyway - e.g. they completed Razorpay Checkout at minute 28
    // and the webhook landed at minute 32 due to network delay. The
    // inventory has already been restored and we won't be fulfilling the
    // order, so:
    //
    //   1. Record the captured payment id on the row (audit trail)
    //   2. Auto-refund the captured amount via Razorpay
    //   3. Stamp paymentAfterCancel + autoRefundInitiated flags
    //   4. SKIP finalizeOrderAfterPayment (no confirmation, no invoice
    //      email, no WhatsApp confirmation - customer was never confirmed)
    //   5. Raise an admin alert on the Notification Alerts dashboard so
    //      ops can verify the auto-refund landed cleanly with Razorpay
    //
    // The 'refund.processed' webhook will fire when Razorpay credits
    // the refund - the normal refund handler picks it up and stamps
    // paymentStatus: REFUNDED. No customer notifications fire on either
    // edge (we explicitly skip them to avoid messaging a customer about
    // an order they were already told was cancelled).
    if (fromStatus === 'CANCELLED') {
      const capturedAmount = entity.amount || 0
      let refundId: string | undefined
      let refundError: string | undefined
      try {
        if (razorpayPaymentId) {
          const refund = await createRefund({
            paymentId: razorpayPaymentId,
            amountPaise: capturedAmount > 0 ? capturedAmount : undefined,
            speed: 'normal',
            notes: {
              reason: 'auto-refund: payment captured after order cancellation',
              orderId: order.rowKey,
            },
          })
          refundId = refund.id
        } else {
          refundError = 'no razorpayPaymentId on captured event'
        }
      } catch (err) {
        refundError = err instanceof Error ? err.message : String(err)
        context.error(
          `razorpayWebhook: auto-refund failed for orderId=${order.rowKey} paymentId=${razorpayPaymentId}`,
          err,
        )
      }

      await mergeOrder(order.partitionKey, order.rowKey, {
        // Record the captured payment id even though we're refunding it -
        // the audit trail must show what happened end-to-end.
        razorpayPaymentId,
        paymentStatus: 'CAPTURED',
        paymentAfterCancel: true,
        autoRefundInitiated: Boolean(refundId),
        razorpayRefundId: refundId || (order.razorpayRefundId as string) || '',
        autoRefundError: refundError || '',
        updatedAt: now,
      })

      await appendOrderEvent({
        partitionKey: order.rowKey,
        rowKey: `${now}_webhook_captured_after_cancel`,
        channel: 'status',
        by: 'razorpay-webhook',
        byRole: 'system',
        note: refundId
          ? `Payment captured AFTER cancellation - auto-refund initiated (refund ${refundId})`
          : `Payment captured AFTER cancellation - auto-refund FAILED: ${refundError || 'unknown'}`,
        meta: JSON.stringify({
          razorpayOrderId,
          razorpayPaymentId,
          capturedAmountPaise: capturedAmount,
          refundId,
          refundError,
          method: entity.method,
        }),
        createdAt: now,
      })

      // Raise the admin alert. Includes the refund outcome so the admin
      // immediately knows whether intervention is needed (refund failed)
      // or just verification (refund pending Razorpay).
      await recordAlert({
        orderId: order.rowKey,
        channel: 'payment',
        operation: 'payment_after_cancel',
        customerName: (order.customerName as string) || '',
        customerContact:
          (order.customerEmail as string) || (order.customerPhone as string) || '',
        reason: refundId
          ? `Late payment received after order cancellation. Auto-refund initiated (refund id ${refundId}). Verify with Razorpay dashboard.`
          : `Late payment received after order cancellation. Auto-refund FAILED: ${refundError || 'unknown error'}. Manual refund required.`,
        attempt: 1,
        isFinal: true,
      })

      // 200 to Razorpay - we've handled the event. Their retry would
      // duplicate our refund attempt; the captured-payment idempotency
      // guard above (already-captured check) protects subsequent webhooks
      // for the same payment id.
      return { status: 200, body: 'ok - captured after cancel, auto-refund initiated' }
    }

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

    // Same orchestration as the verify path - idempotent on invoiceUrl.
    try {
      await finalizeOrderAfterPayment(
        {
          ...order,
          paymentStatus: 'CAPTURED',
          razorpayPaymentId,
          status: toStatus,
          updatedAt: now,
        },
        context,
      )
    } catch (invErr) {
      // Returning non-200 makes Razorpay retry the webhook - which is
      // what we want for transient blob/PDF failures.
      context.error('razorpayWebhook: finalizeOrderAfterPayment failed', invErr)
      return { status: 500, body: 'invoice generation failed - will retry' }
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

    // Fan out the refund notification on both customer channels per the
    // dual-channel policy. Each channel enqueued as a separate message so
    // a transient failure on one doesn't impact the other; the registry
    // dispatcher applies the studio CC on the email side automatically.
    const refundRupees = ((refundEntity.amount ?? 0) / 100).toLocaleString('en-IN', {
      maximumFractionDigits: 2,
    })
    const refundVars = {
      customerName: (order.customerName as string) || 'Customer',
      orderId: order.rowKey as string,
      refundAmount: refundRupees,
    }

    if (order.customerEmail) {
      try {
        await enqueueNotification({
          userEmail: order.customerEmail as string,
          channel: 'email',
          templateKey: 'refund_processed',
          vars: refundVars,
        })
      } catch (notifyErr) {
        context.warn('razorpayWebhook(refund.processed): email enqueue failed (non-fatal)', notifyErr)
      }
    }
    if (order.customerPhone) {
      try {
        await enqueueNotification({
          userEmail: (order.customerEmail as string) || '',
          channel: 'whatsapp',
          templateKey: 'refund_processed',
          vars: refundVars,
        })
      } catch (notifyErr) {
        context.warn('razorpayWebhook(refund.processed): whatsapp enqueue failed (non-fatal)', notifyErr)
      }
    }

    return { status: 200, body: 'ok - refund processed' }
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

    return { status: 200, body: 'ok - refund failure recorded' }
  }

  // Anything else (refund.created, payment.authorized, settlement.*, etc.)
  // - accept and log. Razorpay only retries non-2xx responses, so we want
  // to return 200 here even though we don't act on the payload.
  return { status: 200, body: `ok - ignored event ${event}` }
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
