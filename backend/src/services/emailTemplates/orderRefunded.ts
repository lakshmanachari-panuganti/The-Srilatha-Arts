/**
 * order_refunded email — sent after Razorpay confirms the refund. Surfaces
 * the amount + sets the 5-7 day bank-credit expectation.
 */
import { renderEmail, type BuiltEmail } from './shared'

export interface OrderRefundedInput {
  orderId: string
  customerName: string
  /** Pre-formatted Indian-rupee string, no currency symbol. e.g. "4,349"
   *  Optional because the registry's unified input type makes it optional;
   *  if absent we render without the explicit amount line. */
  refundAmount?: string
}

export function buildOrderRefundedEmail(input: OrderRefundedInput): BuiltEmail {
  const amount = input.refundAmount || ''
  return renderEmail({
    subject: `Refund processed — order ${input.orderId}`,
    preheader: amount
      ? `₹ ${amount} refunded for order ${input.orderId}.`
      : `Refund processed for order ${input.orderId}.`,
    heading: `${firstName(input.customerName)}, your refund is on the way.`,
    introHtml: `
      <p>We&rsquo;ve processed your refund. It typically reflects in your account within
      5&ndash;7 business days, depending on your bank.</p>
    `,
    detailRows: [
      { label: 'Order', value: input.orderId },
      ...(amount ? [{ label: 'Amount', value: `₹ ${amount}` }] : []),
    ],
    footerHtml: `
      <p>If the refund doesn&rsquo;t show up within the expected window, reply to this
      email and we&rsquo;ll trace it with Razorpay together.</p>
      <p style="margin-top:8px;">&mdash; Srilatha</p>
    `,
  })
}

function firstName(full: string): string {
  return (full || 'there').trim().split(/\s+/)[0] || 'there'
}
