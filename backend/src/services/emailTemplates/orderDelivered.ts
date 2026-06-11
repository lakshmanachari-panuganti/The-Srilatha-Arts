/**
 * order_delivered email — sent when admin marks the order DELIVERED.
 * Customer-explicit confirmation rather than relying solely on the
 * courier's own message. Sets up the 72h review-request that the same
 * transition schedules on the queue side.
 */
import { renderEmail, type BuiltEmail } from './shared'

export interface OrderDeliveredInput {
  orderId: string
  customerName: string
  siteUrl?: string
}

export function buildOrderDeliveredEmail(input: OrderDeliveredInput): BuiltEmail {
  const site = (input.siteUrl || 'https://www.srilatha.art').replace(/\/+$/, '')

  return renderEmail({
    subject: `Your piece has arrived — order ${input.orderId}`,
    preheader: `Order ${input.orderId} marked delivered. We hope you love it.`,
    heading: `${firstName(input.customerName)}, your piece has arrived.`,
    introHtml: `
      <p>Hope it&rsquo;s found a good wall ✨</p>
      <p>If anything isn&rsquo;t right when you unpack &mdash; a chip, a missing piece, a
      colour that surprised you in person &mdash; reply to this email right away
      and we&rsquo;ll make it right.</p>
    `,
    detailRows: [{ label: 'Order', value: input.orderId }],
    cta: { label: 'Browse new pieces', href: `${site}/shop` },
    footerHtml: `
      <p>In a few days we&rsquo;ll write again to ask how it&rsquo;s living in your space &mdash;
      a photo or a quick line means the world to us.</p>
      <p style="margin-top:8px;">&mdash; Srilatha</p>
    `,
  })
}

function firstName(full: string): string {
  return (full || 'there').trim().split(/\s+/)[0] || 'there'
}
