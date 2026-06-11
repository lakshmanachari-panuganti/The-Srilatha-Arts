/**
 * order_crafting email — sent when the studio begins crafting the order.
 * Mirrors the WhatsApp template body in docs/templates/template_definition.md
 * so the customer hears the same message on both channels.
 */
import { renderEmail, type BuiltEmail } from './shared'

export interface OrderCraftingInput {
  orderId: string
  customerName: string
}

export function buildOrderCraftingEmail(input: OrderCraftingInput): BuiltEmail {
  return renderEmail({
    subject: `We've started crafting your order — ${input.orderId}`,
    preheader: `Order ${input.orderId} is now being handcrafted in our Hyderabad studio.`,
    heading: `${firstName(input.customerName)}, your piece is in the studio.`,
    introHtml: `
      <p>We&rsquo;ve started crafting your order. Each piece is handmade with care
      in our Hyderabad studio, so it takes a few days to come together properly &mdash;
      we&rsquo;ll keep you posted as it takes shape.</p>
    `,
    detailRows: [{ label: 'Order', value: input.orderId }],
    footerHtml: `
      <p>Thank you for your patience.</p>
      <p style="margin-top:8px;">&mdash; Srilatha</p>
    `,
  })
}

function firstName(full: string): string {
  return (full || 'there').trim().split(/\s+/)[0] || 'there'
}
