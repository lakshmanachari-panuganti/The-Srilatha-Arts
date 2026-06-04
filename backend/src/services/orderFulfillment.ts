/**
 * Post-payment fulfillment orchestrator.
 *
 *   payment captured
 *        ↓
 *   finalizeOrderAfterPayment(order)
 *        ├─► build invoice PDF (services/invoicePdf)
 *        ├─► upload to Azure Blob 'invoices' container (services/blobStorage)
 *        ├─► stamp branded invoiceUrl on the order row
 *        └─► send WhatsApp 'order_confirmation_new_artwork' template
 *            with the PDF as the document header attachment
 *
 * Idempotent: a second invocation on an already-fulfilled order short-
 * circuits before regenerating the PDF (checks `invoiceUrl` on the
 * order row). This matters because both the synchronous verify path
 * AND the webhook handler call this function - whichever lands first
 * does the work, the second is a no-op.
 *
 * The WhatsApp step is a soft failure: if WhatsApp is misconfigured
 * or returns an error, we still keep the invoice URL on the order and
 * append a warning event to the timeline. The customer can still see
 * the invoice in their account; only the push notification is lost.
 */

import type { InvocationContext } from '@azure/functions'
import {
  mergeOrder,
  getOrderItems,
  appendOrderEvent,
  Row,
} from './tableStorage'
import { buildInvoicePdf } from './invoicePdf'
import { uploadInvoicePdf } from './blobStorage'
import { invoiceUrlFor } from './orderNumber'
import { isWhatsAppConfigured, sendTemplateMessage } from './whatsapp'

const WHATSAPP_TEMPLATE = 'order_confirmation_new_artwork'

/**
 * Generate the invoice + send the WhatsApp message for a paid order.
 * Safe to call multiple times - subsequent calls are a no-op once the
 * order has `invoiceUrl` set.
 *
 * Returns the branded invoice URL on success. Throws only on PDF/blob
 * failure (those are recoverable - the next webhook retry will retry).
 * WhatsApp failures are logged via context.warn and an event row but
 * do NOT throw.
 */
export async function finalizeOrderAfterPayment(
  order: Row,
  context: InvocationContext,
): Promise<string | null> {
  // Only run for orders whose payment is actually captured. Belt and
  // braces - the caller already gates this, but defending in depth
  // means an accidental call from a future path won't generate an
  // invoice for an unpaid order.
  if (order.paymentStatus !== 'CAPTURED') {
    context.warn(
      `finalizeOrderAfterPayment: skipped - paymentStatus=${order.paymentStatus} for order ${order.rowKey}`,
    )
    return null
  }

  // Idempotency: if invoice has already been generated, return the
  // existing URL. This avoids regenerating + re-sending WhatsApp when
  // the webhook lands after the synchronous verify path already ran.
  if (order.invoiceUrl) {
    return order.invoiceUrl as string
  }

  const orderId = order.rowKey as string
  const now = new Date().toISOString()

  // ── 1. Build the PDF ─────────────────────────────────────────────
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
      createdAt: (order.createdAt as string) || now,
    },
    invoiceItems,
  )

  // ── 2. Upload to blob ────────────────────────────────────────────
  await uploadInvoicePdf(orderId, pdfBuffer)
  const brandedUrl = invoiceUrlFor(orderId)

  // ── 3. Persist invoiceUrl on the order ──────────────────────────
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

  // ── 4. Send WhatsApp confirmation (soft failure) ────────────────
  await sendWhatsAppConfirmation(order, brandedUrl, context)

  return brandedUrl
}

async function sendWhatsAppConfirmation(
  order: Row,
  invoiceUrl: string,
  context: InvocationContext,
): Promise<void> {
  const orderId = order.rowKey as string
  const phone = (order.customerPhone as string) || ''
  if (!phone) {
    context.warn(`sendWhatsAppConfirmation: no customer phone on order ${orderId}`)
    return
  }
  if (!isWhatsAppConfigured()) {
    context.warn('sendWhatsAppConfirmation: WhatsApp env vars not set - skipping')
    return
  }

  const customerName = ((order.customerName as string) || 'Customer').trim()
  try {
    const result = await sendTemplateMessage({
      toPhone: phone,
      templateName: WHATSAPP_TEMPLATE,
      bodyVariables: [customerName, orderId],
      documentHeader: {
        link: invoiceUrl,
        filename: `invoice-${orderId}.pdf`,
      },
    })

    await appendOrderEvent({
      partitionKey: orderId,
      rowKey: `${new Date().toISOString()}_whatsapp`,
      channel: 'message',
      by: 'system',
      byRole: 'system',
      note: 'Order confirmation sent via WhatsApp',
      meta: JSON.stringify({
        template: WHATSAPP_TEMPLATE,
        waMessageId: result.messageId,
      }),
      createdAt: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    context.warn(`sendWhatsAppConfirmation: ${message}`)
    await appendOrderEvent({
      partitionKey: orderId,
      rowKey: `${new Date().toISOString()}_whatsapp_failed`,
      channel: 'internal',
      by: 'system',
      byRole: 'system',
      note: `WhatsApp confirmation failed: ${message}`,
      createdAt: new Date().toISOString(),
    })
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
