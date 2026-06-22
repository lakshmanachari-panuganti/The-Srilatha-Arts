/**
 * order_shipped email — sent when admin marks the order SHIPPED with
 * tracking + courier (required by state machine). Surfaces tracking
 * prominently so the customer can check the courier's portal.
 */
import { renderEmail, escapeHtml, type BuiltEmail } from './shared'
import { CONTACT } from '../../config/contact'

export interface OrderShippedInput {
  orderId: string
  customerName: string
  courier?: string
  tracking?: string
  /** Optional tracking-portal URL. If absent we just show the tracking number. */
  trackingUrl?: string
}

export function buildOrderShippedEmail(input: OrderShippedInput): BuiltEmail {
  const courier = input.courier || 'the courier'
  const tracking = input.tracking || ''
  const trackingHref =
    input.trackingUrl ||
    (tracking
      ? `https://www.google.com/search?q=${encodeURIComponent(`${courier} tracking ${tracking}`)}`
      : '')

  return renderEmail({
    subject: `Your piece is on its way — order ${input.orderId}`,
    preheader: `Shipped via ${input.courier}. Tracking: ${input.tracking}`,
    heading: `${firstName(input.customerName)}, your piece is on the road.`,
    introHtml: `
      <p>Your order has shipped 📦 You should receive it soon &mdash; the timing depends on
      the courier and your location. If anything looks off when it arrives, reply to this
      email and we&rsquo;ll sort it out.</p>
    `,
    detailRows: [
      { label: 'Order', value: input.orderId },
      ...(input.courier ? [{ label: 'Courier', value: input.courier }] : []),
      ...(input.tracking ? [{ label: 'Tracking', value: input.tracking }] : []),
    ],
    ...(trackingHref
      ? { cta: { label: 'Track your piece', href: trackingHref } as const }
      : {}),
    footerHtml: `
      <p>If you have any questions, just reply to this email or write to ${CONTACT.email}.</p>
      <p style="margin-top:8px;">&mdash; Srilatha</p>
    `,
  })
}

function firstName(full: string): string {
  return (full || 'there').trim().split(/\s+/)[0] || 'there'
}

// Silence unused-import warning if escapeHtml ends up only referenced in jsdoc.
void escapeHtml
