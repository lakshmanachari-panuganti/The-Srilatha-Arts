/**
 * order_on_hold email — sent when admin pauses the order for any reason
 * (stock issue, address verification, payment review). The hold reason
 * is provided by the admin at the moment of transition.
 */
import { renderEmail, type BuiltEmail } from './shared'

export interface OrderOnHoldInput {
  orderId: string
  customerName: string
  holdReason?: string
}

export function buildOrderOnHoldEmail(input: OrderOnHoldInput): BuiltEmail {
  return renderEmail({
    subject: `Order ${input.orderId} is on hold`,
    preheader: `Order ${input.orderId} paused while we sort something out.`,
    heading: `${firstName(input.customerName)}, a quick note about your order.`,
    introHtml: `
      <p>We&rsquo;ve put your order on hold while we sort something out:</p>
      <p style="margin-top:8px;font-style:italic;">${escapeForP(input.holdReason || 'Please check with us for details.')}</p>
    `,
    detailRows: [{ label: 'Order', value: input.orderId }],
    footerHtml: `
      <p>We&rsquo;ll be in touch as soon as we can move forward. Thank you for your patience.</p>
      <p style="margin-top:8px;">&mdash; Srilatha</p>
    `,
  })
}

function firstName(full: string): string {
  return (full || 'there').trim().split(/\s+/)[0] || 'there'
}

function escapeForP(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
