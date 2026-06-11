/**
 * order_cancelled email — sent when admin (or the customer-side cancel
 * route) flips the order to CANCELLED. Includes the documented reason so
 * the customer isn't surprised; sets expectations on the refund timeline.
 */
import { renderEmail, type BuiltEmail } from './shared'

export interface OrderCancelledInput {
  orderId: string
  customerName: string
  cancelReason?: string
}

export function buildOrderCancelledEmail(input: OrderCancelledInput): BuiltEmail {
  return renderEmail({
    subject: `Order ${input.orderId} has been cancelled`,
    preheader: `Order ${input.orderId} cancelled. ${input.cancelReason || ''}`.trim(),
    heading: `${firstName(input.customerName)}, your order has been cancelled.`,
    introHtml: `
      <p>We&rsquo;re sorry for the inconvenience. If you&rsquo;d paid online, your refund
      will be processed shortly &mdash; banks typically take 5&ndash;7 working days to
      credit the amount back to your account.</p>
    `,
    detailRows: [
      { label: 'Order', value: input.orderId },
      ...(input.cancelReason ? [{ label: 'Reason', value: input.cancelReason }] : []),
    ],
    footerHtml: `
      <p>If you have any questions, reply to this message or write to studio@srilatha.art.</p>
      <p style="margin-top:8px;">&mdash; Srilatha</p>
    `,
  })
}

function firstName(full: string): string {
  return (full || 'there').trim().split(/\s+/)[0] || 'there'
}
