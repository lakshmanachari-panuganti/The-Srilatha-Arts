/**
 * review_request email — sent 72h after the order is marked DELIVERED.
 * Mirrors the WhatsApp review_request template in tone. Links to the
 * customer's order page so they can leave the review against the right
 * product.
 */
import { renderEmail, type BuiltEmail } from './shared'
import { CONTACT } from '../../config/contact'

export interface ReviewRequestInput {
  orderId: string
  customerName: string
  siteUrl?: string
}

export function buildReviewRequestEmail(input: ReviewRequestInput): BuiltEmail {
  const site = (input.siteUrl || CONTACT.websiteUrl).replace(/\/+$/, '')

  return renderEmail({
    subject: `How's your piece living with you?`,
    preheader: `Share a review or a photo of how your Srilatha Art piece looks at home.`,
    heading: `${firstName(input.customerName)}, we hope you're loving your piece.`,
    introHtml: `
      <p>Each piece we make is a labour of love &mdash; we&rsquo;d be honoured if you shared
      a review or a photo of how it lives in your space.</p>
      <p>It only takes a minute, and it means a great deal to a small studio.</p>
    `,
    detailRows: [{ label: 'Order', value: input.orderId }],
    cta: { label: 'Leave a review', href: `${site}/account/orders` },
    footerHtml: `
      <p>You can also reply here, write to ${CONTACT.email}, or tag us on
      Instagram <a href="${CONTACT.instagramUrl}" style="color:#8a6a1a;">${CONTACT.instagramHandleAt}</a>.</p>
      <p style="margin-top:8px;">&mdash; Srilatha</p>
    `,
  })
}

function firstName(full: string): string {
  return (full || 'there').trim().split(/\s+/)[0] || 'there'
}
