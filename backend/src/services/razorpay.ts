/**
 * Razorpay Payment Gateway integration (§7).
 *
 * Three touchpoints in our flow:
 *
 *   1. POST /api/payments/create-order   → createRazorpayOrder()
 *      We are the source of truth for amounts; this is called only after
 *      we've already re-computed totals server-side.
 *
 *   2. POST /api/payments/verify          → verifyPaymentSignature()
 *      Synchronous confirmation hop after the Razorpay Checkout closes.
 *      The signature is HMAC-SHA256(order_id|payment_id, KEY_SECRET).
 *
 *   3. POST /api/payments/webhook         → verifyWebhookSignature()
 *      Asynchronous backup. Razorpay POSTs JSON with X-Razorpay-Signature.
 *      We verify with HMAC-SHA256(raw_body, WEBHOOK_SECRET) — using the
 *      RAW request bytes, not parsed JSON, because re-serializing would
 *      reorder keys and break the digest.
 *
 * Never log the KEY_SECRET; only the KEY_ID is exposed (it's also the
 * value the frontend uses to open Razorpay Checkout).
 */

import { createHmac, timingSafeEqual } from 'crypto'

const KEY_ID = process.env.RAZORPAY_KEY_ID
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET

export function isRazorpayConfigured(): boolean {
  return Boolean(KEY_ID && KEY_SECRET)
}

export function getPublicKeyId(): string | null {
  return KEY_ID || null
}

export interface RazorpayOrder {
  id: string
  amount: number     // in paise
  currency: string
  receipt: string
  status: string
  created_at: number
}

export interface CreateOrderInput {
  amountPaise: number
  currency?: string         // default 'INR'
  receipt: string           // our internal order id
  notes?: Record<string, string>
}

/**
 * Create a Razorpay Order via REST API.
 * https://razorpay.com/docs/api/orders/#create-an-order
 */
export async function createRazorpayOrder(input: CreateOrderInput): Promise<RazorpayOrder> {
  if (!KEY_ID || !KEY_SECRET) {
    throw new Error('[razorpay] RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not configured')
  }
  if (!Number.isInteger(input.amountPaise) || input.amountPaise <= 0) {
    throw new Error('[razorpay] amount must be a positive integer (paise)')
  }

  const basicAuth = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64')

  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: input.currency || 'INR',
      receipt: input.receipt,
      notes: input.notes || {},
      // Wait for the customer to interact with Checkout — do NOT auto-capture
      // partial payments. Razorpay defaults are fine for our flow.
    }),
  })

  if (!res.ok) {
    let detail = ''
    try {
      const data = (await res.json()) as { error?: { description?: string } }
      detail = data.error?.description || JSON.stringify(data)
    } catch {
      detail = await res.text()
    }
    throw new Error(`[razorpay] order create failed (${res.status}): ${detail}`)
  }

  return (await res.json()) as RazorpayOrder
}

export interface RazorpayRefund {
  id: string             // 'rfnd_...'
  payment_id: string     // the parent payment
  amount: number         // paise
  currency: string
  status: 'pending' | 'processed' | 'failed'
  created_at: number
  speed_processed?: string
  notes?: Record<string, string>
}

export interface CreateRefundInput {
  paymentId: string
  amountPaise?: number              // omit for full refund
  notes?: Record<string, string>
  speed?: 'normal' | 'optimum'      // 'normal' = 5-7 days, 'optimum' = instant where possible
}

/**
 * Issue a refund against a captured payment.
 *
 * https://razorpay.com/docs/api/refunds/#create-refund
 *
 * Razorpay charges a small fee per refund and may take 5-7 working days
 * to credit back to the customer's card / 1-2 days for UPI / netbanking.
 * Speed = 'optimum' attempts instant refund where the issuer allows it.
 */
export async function createRefund(input: CreateRefundInput): Promise<RazorpayRefund> {
  if (!KEY_ID || !KEY_SECRET) {
    throw new Error('[razorpay] RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not configured')
  }
  if (!input.paymentId) {
    throw new Error('[razorpay] paymentId is required')
  }
  if (input.amountPaise != null) {
    if (!Number.isInteger(input.amountPaise) || input.amountPaise <= 0) {
      throw new Error('[razorpay] amountPaise must be a positive integer')
    }
  }

  const basicAuth = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64')
  const body: Record<string, unknown> = {}
  if (input.amountPaise != null) body.amount = input.amountPaise
  if (input.notes) body.notes = input.notes
  if (input.speed) body.speed = input.speed

  const res = await fetch(
    `https://api.razorpay.com/v1/payments/${encodeURIComponent(input.paymentId)}/refund`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  )

  if (!res.ok) {
    let detail = ''
    try {
      const data = (await res.json()) as { error?: { description?: string; code?: string } }
      detail = data.error?.description || data.error?.code || JSON.stringify(data)
    } catch {
      detail = await res.text()
    }
    throw new Error(`[razorpay] refund failed (${res.status}): ${detail}`)
  }

  return (await res.json()) as RazorpayRefund
}

/**
 * Constant-time HMAC compare. timingSafeEqual throws on length mismatch
 * so we guard for that explicitly.
 */
function safeEqualHex(actualHex: string, expectedHex: string): boolean {
  if (actualHex.length !== expectedHex.length) return false
  try {
    return timingSafeEqual(Buffer.from(actualHex, 'hex'), Buffer.from(expectedHex, 'hex'))
  } catch {
    return false
  }
}

/**
 * Verify the signature returned by Razorpay Checkout to the browser.
 *
 *   sig = HMAC_SHA256(`${order_id}|${payment_id}`, KEY_SECRET)
 *
 * https://razorpay.com/docs/payments/server-integration/nodejs/payment-gateway/build-integration/#step-4-verify-payment-signature
 */
export function verifyPaymentSignature(input: {
  razorpayOrderId: string
  razorpayPaymentId: string
  razorpaySignature: string
}): boolean {
  if (!KEY_SECRET) return false
  const expected = createHmac('sha256', KEY_SECRET)
    .update(`${input.razorpayOrderId}|${input.razorpayPaymentId}`)
    .digest('hex')
  return safeEqualHex(input.razorpaySignature, expected)
}

/**
 * Verify a webhook from Razorpay. The signature is on the RAW body —
 * always pass the exact bytes from the request, not a re-serialized JSON.
 *
 *   sig = HMAC_SHA256(raw_body, WEBHOOK_SECRET)
 */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string): boolean {
  if (!WEBHOOK_SECRET) return false
  if (!signatureHeader) return false
  const expected = createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex')
  return safeEqualHex(signatureHeader, expected)
}
