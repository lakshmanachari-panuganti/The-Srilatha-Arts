/**
 * Post-payment fulfillment orchestrator.
 *
 *   payment captured
 *        ↓
 *   finalizeOrderAfterPayment(order)
 *        ├─► (idempotent) build invoice PDF + upload to blob + stamp invoiceUrl
 *        ├─► enqueue WhatsApp notification (order_confirmed → Meta: order_confirmation_v1)
 *        └─► enqueue email notification (order_confirmed)
 *
 *   notifications-out queue consumer (functions/notificationsQueue)
 *        ├─► reads message
 *        ├─► fetches the SAME PDF from blob (no regeneration)
 *        └─► sends via the chosen channel
 *
 * This is the single source of truth for invoice PDFs in the system.
 * Every downstream artefact (WhatsApp document, email attachment, the
 * customer's Download button, the admin's resend action) reads the
 * exact same blob produced here.
 *
 * Idempotency: a second invocation on an already-fulfilled order
 * short-circuits before regenerating (checks invoiceUrl on the row).
 * This matters because both the verify path AND the webhook handler
 * call this function - whichever lands first does the work, the second
 * is a no-op.
 */

import type { InvocationContext } from '@azure/functions'
import {
  mergeOrder,
  getOrderItems,
  appendOrderEvent,
  getCoupon,
  upsertCoupon,
  createCouponRedemption,
  Row,
} from './tableStorage'
import { buildInvoicePdf } from './invoicePdf'
import { uploadInvoicePdf } from './blobStorage'
import { invoiceUrlFor } from './orderNumber'
import { enqueueNotification } from './queue'
import { recordAlert } from './notificationAlerts'
import {
  enqueueStudioAdminNotifications,
  ADMIN_NEW_ORDER_TEMPLATE_KEY,
} from './adminNotifications'

/**
 * Build the invoice PDF for an order, upload it to blob, and stamp
 * invoiceUrl on the order row. Idempotent - returns the existing URL
 * unchanged if invoiceUrl is already set on the order.
 *
 * Exposed separately from finalizeOrderAfterPayment so the admin
 * resend endpoint can call it standalone (self-healing) before re-
 * queuing a delivery.
 */
export async function ensureInvoicePdf(
  order: Row,
  context: InvocationContext,
): Promise<string> {
  const orderId = order.rowKey as string

  // Defence-in-depth: never generate a receipt for an order where money
  // never changed hands. The verify + webhook paths already gate on
  // CAPTURED before calling us, but admin "resend email/whatsapp"
  // endpoints route here without that check — so guard at the source.
  // COD is intentionally included so cash-on-delivery orders still get
  // a receipt at fulfillment time even though paymentStatus isn't
  // CAPTURED. REFUNDED is also allowed because the original receipt
  // remains a valid record of the historical transaction.
  const ps = (order.paymentStatus as string || '').toUpperCase()
  if (ps !== 'CAPTURED' && ps !== 'COD' && ps !== 'REFUNDED') {
    throw new Error(
      `ensureInvoicePdf refused: paymentStatus="${ps}" for order ${orderId} is not eligible for a receipt`,
    )
  }

  if (order.invoiceUrl) {
    return order.invoiceUrl as string
  }

  try {
    return await _generateInvoicePdf(order, context)
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    // Surface invoice failures on the admin dashboard — without an invoice
    // the customer can't be confirmed via the WhatsApp path (DOCUMENT header
    // requires the blob) and email order_confirmed loses its attachment.
    await recordAlert({
      orderId,
      channel: 'invoice',
      operation: 'invoice_generation',
      customerName: (order.customerName as string) || '',
      customerContact: (order.customerEmail as string) || (order.customerPhone as string) || '',
      reason: errMsg,
      attempt: 1,
      // Invoice generation isn't queue-backed today, so a single failure is
      // already "final" from the admin's perspective. They'll see it in the
      // dashboard, hit Resend on the order, which re-runs ensureInvoicePdf.
      isFinal: true,
    })
    throw err
  }
}

async function _generateInvoicePdf(
  order: Row,
  context: InvocationContext,
): Promise<string> {
  const orderId = order.rowKey as string
  const items = await getOrderItems(orderId)
  const invoiceItems = items.map((i) => ({
    productId: i.rowKey as string,
    title: (i.title as string) || '',
    category: (i.category as string) || '',
    imageUrl: (i.imageUrl as string) || undefined,
    displayPrice: Number(i.displayPrice ?? 0),
    qty: Number(i.qty ?? 1),
  }))

  const pdfBuffer = await buildInvoicePdf(
    {
      id: orderId,
      status: order.status as string,
      paymentStatus: order.paymentStatus as string,
      displayTotal: Number(order.displayTotal ?? 0),
      subtotal: typeof order.subtotal === 'number' ? order.subtotal : undefined,
      shippingAmount: typeof order.shippingAmount === 'number' ? order.shippingAmount : undefined,
      discountAmount: typeof order.discountAmount === 'number' ? order.discountAmount : undefined,
      couponCode: (order.couponCode as string) || undefined,
      customerName: (order.customerName as string) || '',
      customerEmail: (order.customerEmail as string) || undefined,
      customerPhone: (order.customerPhone as string) || undefined,
      shippingAddress: parseAddress(order.shippingAddress),
      razorpayPaymentId: (order.razorpayPaymentId as string) || undefined,
      createdAt: (order.createdAt as string) || new Date().toISOString(),
    },
    invoiceItems,
  )

  await uploadInvoicePdf(orderId, pdfBuffer)
  const brandedUrl = invoiceUrlFor(orderId)

  const now = new Date().toISOString()
  await mergeOrder(order.partitionKey as string, orderId, {
    invoiceUrl: brandedUrl,
    updatedAt: now,
  })

  await appendOrderEvent({
    partitionKey: orderId,
    rowKey: `${now}_invoice`,
    channel: 'system',
    by: 'system',
    byRole: 'system',
    note: 'Invoice generated',
    meta: JSON.stringify({ invoiceUrl: brandedUrl }),
    createdAt: now,
  })
  context.log(`ensureInvoicePdf: generated invoice for ${orderId}`)

  return brandedUrl
}

/**
 * Final post-payment work: ensure the invoice PDF exists, then enqueue
 * WhatsApp + email deliveries. Returns the branded invoice URL on
 * success, or null if the order is not captured / has no contact info.
 */
export async function finalizeOrderAfterPayment(
  order: Row,
  context: InvocationContext,
): Promise<string | null> {
  if (order.paymentStatus !== 'CAPTURED') {
    context.warn(
      `finalizeOrderAfterPayment: skipped - paymentStatus=${order.paymentStatus} for order ${order.rowKey}`,
    )
    return null
  }

  const orderId = order.rowKey as string
  const invoiceUrl = await ensureInvoicePdf(order, context)

  // Record coupon redemption + bump currentUsage on the coupon row.
  // Idempotent: createCouponRedemption uses orderId as the rowKey, so a
  // re-run (verify + webhook both landing) errors with EntityAlreadyExists
  // and the increment is skipped. A non-fatal failure here must not block
  // invoice / notifications - the order itself is already captured.
  await recordCouponRedemption(order, context)

  // ── Enqueue WhatsApp ─────────────────────────────────────────────
  // Soft-skip if no phone or WhatsApp isn't configured at the consumer
  // side; the queue consumer will record the skip in its event log.
  if (order.customerPhone) {
    try {
      await enqueueNotification({
        userEmail: (order.customerEmail as string) || (order.partitionKey as string) || '',
        channel: 'whatsapp',
        templateKey: 'order_confirmed',
        vars: {
          orderId,
          customerName: (order.customerName as string) || 'Customer',
          customerPhone: (order.customerPhone as string) || '',
          invoiceUrl,
        },
      })
    } catch (err) {
      context.warn('finalizeOrderAfterPayment: WhatsApp enqueue failed', err)
    }
  }

  // ── Enqueue email ────────────────────────────────────────────────
  if (order.customerEmail) {
    try {
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
      // Optimistic 'pending' status so the admin UI shows that the email
      // is in flight even before the consumer processes it.
      await mergeOrder(order.partitionKey as string, orderId, {
        emailStatus: 'pending',
        updatedAt: new Date().toISOString(),
      })
    } catch (err) {
      context.warn('finalizeOrderAfterPayment: email enqueue failed', err)
    }
  }

  // ── Ping the studio admins ───────────────────────────────────────
  // Enqueue-only (one message per admin) so no Meta latency lands on the
  // payment-verify response and a transient Meta failure is retried by the
  // queue instead of being lost. Never throws; an empty / unconfigured
  // admin list is a warn-and-continue.
  try {
    const fanout = await enqueueStudioAdminNotifications({
      templateName: ADMIN_NEW_ORDER_TEMPLATE_KEY,
      customerName: (order.customerName as string) || '',
      customerPhone: (order.customerPhone as string) || '',
      referenceId: orderId,
      context,
    })
    context.log(
      `finalizeOrderAfterPayment: studio-admin fan-out for ${orderId} — enqueued=${fanout.enqueued} skipped=${fanout.skipped} failed=${fanout.failed}`,
    )
  } catch (notifyErr) {
    context.warn(
      `finalizeOrderAfterPayment: unexpected admin fan-out error for ${orderId} (non-fatal): ${String(notifyErr)}`,
    )
  }

  return invoiceUrl
}

/**
 * Idempotently record that the coupon on this order has been redeemed.
 * Uses orderId as the redemption rowKey so a duplicate call (verify +
 * webhook both finalizing) is rejected by table storage and we skip the
 * coupon currentUsage increment. Soft-fails: a failure here does not
 * block invoice generation or notifications.
 */
async function recordCouponRedemption(order: Row, context: InvocationContext): Promise<void> {
  const code = ((order.couponCode as string) || '').trim().toUpperCase()
  const discountAmount = Number(order.discountAmount ?? 0)
  if (!code || discountAmount <= 0) return

  const orderId = order.rowKey as string
  const userEmail = (order.partitionKey as string) || ''
  const now = new Date().toISOString()

  try {
    await createCouponRedemption({
      partitionKey: code,
      rowKey: orderId,
      userEmail,
      discountAmount,
      redeemedAt: now,
    })
  } catch (err: any) {
    // Already redeemed (verify + webhook race) - safe to no-op without
    // double-incrementing the coupon usage counter.
    if (err?.statusCode === 409) return
    context.warn(`recordCouponRedemption: createCouponRedemption failed for ${orderId}/${code}`, err)
    return
  }

  try {
    const coupon = await getCoupon(code)
    if (!coupon) return
    const next = {
      ...coupon,
      currentUsage: Number(coupon.currentUsage ?? 0) + 1,
      updatedAt: now,
    } as Row
    await upsertCoupon(next)
  } catch (err) {
    // The redemption row is recorded so admins still see it; the counter
    // will drift but is recoverable from the redemptions table.
    context.warn(`recordCouponRedemption: incrementing currentUsage failed for ${code}`, err)
  }
}

function parseAddress(raw: unknown): InvoiceOrderShippingAddress | undefined {
  if (!raw) return undefined
  if (typeof raw === 'object') return raw as InvoiceOrderShippingAddress
  try {
    return JSON.parse(String(raw)) as InvoiceOrderShippingAddress
  } catch {
    return undefined
  }
}

type InvoiceOrderShippingAddress = {
  fullName?: string
  phone?: string
  line1?: string
  line2?: string
  city?: string
  state?: string
  pincode?: string
  country?: string
}
