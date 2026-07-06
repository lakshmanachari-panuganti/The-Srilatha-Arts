/**
 * return_declined email - sent when the admin rejects a return request.
 * Mirrors return_declined_v1 WhatsApp copy: acknowledges the decision,
 * links to the returns policy, and provides the studio contact channel
 * so the customer can escalate if needed.
 */
import { renderEmail, type BuiltEmail } from './shared'
import { CONTACT } from '../../config/contact'

export interface ReturnDeclinedInput {
  orderId: string
  customerName: string
  reason?: string
  siteUrl?: string
}

export function buildReturnDeclinedEmail(input: ReturnDeclinedInput): BuiltEmail {
  const site = (input.siteUrl || CONTACT.websiteUrl).replace(/\/+$/, '')
  return renderEmail({
    subject: `Return request for ${input.orderId} was declined`,
    preheader: `Your return request for ${input.orderId} has been declined per our policy.`,
    heading: `${firstName(input.customerName)}, we couldn't approve this return.`,
    introHtml: `
      <p>We&rsquo;re sorry to share that your return request for order
      <strong>${input.orderId}</strong> has been declined in line with our
      returns policy.</p>
      ${
        input.reason
          ? `<p><em>Reason from our team:</em> ${input.reason}</p>`
          : ''
      }
    `,
    detailRows: [{ label: 'Order', value: input.orderId }],
    cta: { label: 'Read our returns policy', href: `${site}/shipping-and-returns` },
    footerHtml: `
      <p>If you have any questions or need clarification, reply here or write
      to ${CONTACT.email}.</p>
      <p style="margin-top:8px;">&mdash; Srilatha</p>
    `,
  })
}

function firstName(full: string): string {
  return (full || 'there').trim().split(/\s+/)[0] || 'there'
}
