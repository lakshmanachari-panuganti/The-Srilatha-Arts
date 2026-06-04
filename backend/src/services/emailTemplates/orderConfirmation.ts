/**
 * Order confirmation email template.
 *
 * Visual brief mirrors the on-screen invoice (ivory paper, gold trim,
 * espresso ink) so the inbox + the /account/invoices page + the
 * attached PDF all read as the same artefact.
 *
 * Output: { subject, html, text } - the html is a table-based, inline-
 * styled layout that survives Outlook, Gmail, Apple Mail, and the major
 * mobile clients. No external CSS, no remote fonts, no JS.
 */

export interface OrderConfirmationItem {
  productId: string
  title: string
  category?: string
  imageUrl?: string
  qty: number
  displayPrice: number
}

export interface OrderConfirmationVars {
  orderId: string
  invoiceUrl: string
  customerName: string
  customerEmail: string
  customerPhone?: string
  displayTotal: number
  subtotal?: number       // paise
  shippingAmount?: number // paise
  discountAmount?: number // paise
  couponCode?: string
  razorpayPaymentId?: string
  paymentStatus: string
  shippingAddress?: {
    fullName?: string
    line1?: string
    line2?: string
    city?: string
    state?: string
    pincode?: string
    country?: string
    phone?: string
  }
  items: OrderConfirmationItem[]
  createdAt: string
  /** Branded site URL e.g. https://www.srilatha.art - used for "View Invoice" CTA. */
  siteUrl: string
}

interface BuiltEmail {
  subject: string
  html: string
  text: string
}

// ── Brand palette - kept aligned with frontend/app/globals.css :root ──
const COLOR = {
  ink: '#221b12',
  inkSoft: '#43392e',
  inkMute: '#8a7e6e',
  rule: '#e1dbcf',
  gold: '#b88a2d',
  goldDeep: '#8a6a1a',
  paper: '#fdfcf8',
  paperDeep: '#f6f1e6',
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function fmtMoney(rs: number): string {
  return `₹ ${rs.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    })
  } catch {
    return iso
  }
}

function paymentPillHtml(status: string): string {
  const s = (status || '').toUpperCase()
  const isPaid = s === 'PAID' || s === 'CAPTURED'
  const isRefund = s === 'REFUNDED'
  const label = isPaid ? 'Paid' : isRefund ? 'Refunded' : 'Payment pending'
  const bg = isPaid ? '#ecfdf5' : isRefund ? '#f1f5f9' : '#fff7e0'
  const txt = isPaid ? '#065f46' : isRefund ? '#334155' : COLOR.goldDeep
  const ring = isPaid ? '#a7f3d0' : isRefund ? '#cbd5e1' : '#e8c25a'
  return `<span style="display:inline-block;padding:4px 10px;font-size:11px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;background:${bg};color:${txt};border:1px solid ${ring};border-radius:999px;">${escapeHtml(label)}</span>`
}

function addressHtml(addr: OrderConfirmationVars['shippingAddress'], fallbackName: string): string {
  if (!addr) return '<span style="color:#8a7e6e;">No address on file</span>'
  const lines: string[] = []
  const name = addr.fullName || fallbackName
  if (name) lines.push(`<strong style="color:${COLOR.ink};">${escapeHtml(name)}</strong>`)
  const street = [addr.line1, addr.line2].filter(Boolean).join(', ')
  if (street) lines.push(escapeHtml(street))
  const cityLine = [addr.city, addr.state].filter(Boolean).join(', ')
  const cityPin = addr.pincode ? `${cityLine} ${addr.pincode}` : cityLine
  if (cityPin) lines.push(escapeHtml(cityPin))
  if (addr.country) lines.push(escapeHtml(addr.country))
  if (addr.phone) lines.push(escapeHtml(addr.phone))
  return lines.join('<br/>')
}

function itemRowsHtml(items: OrderConfirmationItem[]): string {
  if (!items.length) {
    return `<tr><td colspan="3" style="padding:18px 0;color:${COLOR.inkMute};font-size:14px;">No items recorded on this order.</td></tr>`
  }
  return items
    .map((it) => {
      const total = it.displayPrice * it.qty
      const thumb = it.imageUrl
        ? `<img src="${escapeHtml(it.imageUrl)}" alt="" width="56" height="56" style="display:block;border-radius:6px;border:1px solid ${COLOR.rule};object-fit:cover;background:${COLOR.paper};"/>`
        : `<div style="width:56px;height:56px;border-radius:6px;border:1px solid ${COLOR.rule};background:${COLOR.paper};"></div>`
      const collection = it.category
        ? `<div style="font-size:10px;letter-spacing:0.12em;color:${COLOR.inkMute};text-transform:uppercase;margin-top:2px;">${escapeHtml(it.category)}</div>`
        : ''
      return `
<tr>
  <td style="padding:14px 0;border-bottom:1px solid ${COLOR.rule};vertical-align:top;width:72px;">${thumb}</td>
  <td style="padding:14px 0 14px 12px;border-bottom:1px solid ${COLOR.rule};vertical-align:top;">
    <div style="font-size:14px;color:${COLOR.ink};font-weight:600;">${escapeHtml(it.title)}</div>
    ${collection}
    <div style="font-size:12px;color:${COLOR.inkMute};margin-top:6px;">Qty ${it.qty} &middot; ${fmtMoney(it.displayPrice)} each</div>
  </td>
  <td style="padding:14px 0;border-bottom:1px solid ${COLOR.rule};vertical-align:top;text-align:right;white-space:nowrap;font-size:14px;color:${COLOR.ink};font-weight:600;">${fmtMoney(total)}</td>
</tr>`
    })
    .join('')
}

function summaryRowsHtml(vars: OrderConfirmationVars): string {
  const rows: string[] = []
  const push = (label: string, value: string) => {
    rows.push(`
<tr>
  <td style="padding:4px 0;color:${COLOR.inkSoft};font-size:14px;">${label}</td>
  <td style="padding:4px 0;text-align:right;color:${COLOR.ink};font-size:14px;">${value}</td>
</tr>`)
  }
  if (typeof vars.subtotal === 'number') push('Subtotal', fmtMoney(vars.subtotal / 100))
  if (typeof vars.shippingAmount === 'number') {
    push('Shipping', vars.shippingAmount > 0 ? fmtMoney(vars.shippingAmount / 100) : 'Free')
  }
  if (typeof vars.discountAmount === 'number' && vars.discountAmount > 0) {
    const label = vars.couponCode ? `Discount (${vars.couponCode})` : 'Discount'
    push(label, `- ${fmtMoney(vars.discountAmount / 100)}`)
  }
  return rows.join('')
}

export function buildOrderConfirmationEmail(vars: OrderConfirmationVars): BuiltEmail {
  const subject = `Order ${vars.orderId} confirmed - Srilatha Art`
  const viewInvoiceUrl = vars.invoiceUrl
  const accountOrderUrl = `${vars.siteUrl.replace(/\/+$/, '')}/account/orders/${vars.orderId}`

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${COLOR.paperDeep};font-family:'Helvetica Neue',Arial,sans-serif;color:${COLOR.ink};">
  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:transparent;opacity:0;">
    Your order ${escapeHtml(vars.orderId)} has been confirmed. Your invoice is attached.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLOR.paperDeep};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:${COLOR.paper};border:1px solid ${COLOR.rule};border-radius:14px;overflow:hidden;">
          <!-- Gold trim -->
          <tr>
            <td style="height:4px;background:${COLOR.gold};line-height:4px;font-size:0;">&nbsp;</td>
          </tr>
          <!-- Header -->
          <tr>
            <td style="padding:32px 36px 8px 36px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <div style="font-size:22px;font-weight:700;letter-spacing:0.04em;color:${COLOR.ink};">Srilatha Art</div>
                    <div style="font-size:12px;color:${COLOR.inkMute};margin-top:2px;">Handcrafted in Hyderabad</div>
                  </td>
                  <td style="vertical-align:middle;text-align:right;">
                    ${paymentPillHtml(vars.paymentStatus)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Thank-you -->
          <tr>
            <td style="padding:28px 36px 8px 36px;">
              <div style="font-size:24px;color:${COLOR.ink};font-weight:600;line-height:1.25;">Thank you, ${escapeHtml(vars.customerName.split(' ')[0] || vars.customerName)}.</div>
              <div style="font-size:14px;color:${COLOR.inkSoft};margin-top:8px;line-height:1.55;">
                Your order has been confirmed and we're getting it ready for you.
                Each piece from our studio is individually crafted, so please
                allow our makers a little time before dispatch.
              </div>
            </td>
          </tr>
          <!-- Order meta -->
          <tr>
            <td style="padding:24px 36px 0 36px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${COLOR.rule};border-bottom:1px solid ${COLOR.rule};">
                <tr>
                  <td style="padding:14px 0;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${COLOR.inkMute};">Order</td>
                  <td style="padding:14px 0;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${COLOR.inkMute};">Date</td>
                  <td style="padding:14px 0;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${COLOR.inkMute};">Invoice</td>
                </tr>
                <tr>
                  <td style="padding:0 0 14px 0;font-size:14px;color:${COLOR.ink};font-weight:600;">${escapeHtml(vars.orderId)}</td>
                  <td style="padding:0 0 14px 0;font-size:14px;color:${COLOR.ink};">${escapeHtml(fmtDate(vars.createdAt))}</td>
                  <td style="padding:0 0 14px 0;font-size:14px;color:${COLOR.ink};">${escapeHtml(vars.orderId)}</td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Customer + shipping -->
          <tr>
            <td style="padding:24px 36px 0 36px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="top" style="width:50%;padding-right:14px;">
                    <div style="font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:${COLOR.inkMute};font-weight:700;">Billed to</div>
                    <div style="font-size:14px;color:${COLOR.ink};font-weight:600;margin-top:6px;">${escapeHtml(vars.customerName)}</div>
                    <div style="font-size:13px;color:${COLOR.inkSoft};margin-top:2px;">${escapeHtml(vars.customerEmail)}</div>
                    ${vars.customerPhone ? `<div style="font-size:13px;color:${COLOR.inkSoft};">${escapeHtml(vars.customerPhone)}</div>` : ''}
                  </td>
                  <td valign="top" style="width:50%;padding-left:14px;">
                    <div style="font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:${COLOR.inkMute};font-weight:700;">Ship to</div>
                    <div style="font-size:13px;color:${COLOR.inkSoft};line-height:1.55;margin-top:6px;">${addressHtml(vars.shippingAddress, vars.customerName)}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Items -->
          <tr>
            <td style="padding:24px 36px 0 36px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:${COLOR.inkMute};font-weight:700;padding:14px 0 6px 0;border-top:1px solid ${COLOR.ink};">Item</td>
                  <td style="font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:${COLOR.inkMute};font-weight:700;padding:14px 0 6px 12px;border-top:1px solid ${COLOR.ink};"></td>
                  <td style="font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:${COLOR.inkMute};font-weight:700;padding:14px 0 6px 0;border-top:1px solid ${COLOR.ink};text-align:right;">Amount</td>
                </tr>
                ${itemRowsHtml(vars.items)}
              </table>
            </td>
          </tr>
          <!-- Totals -->
          <tr>
            <td style="padding:8px 36px 0 36px;">
              <table role="presentation" align="right" cellpadding="0" cellspacing="0" border="0" style="width:260px;">
                ${summaryRowsHtml(vars)}
                <tr>
                  <td colspan="2" style="padding-top:8px;border-top:1px solid ${COLOR.ink};"></td>
                </tr>
                <tr>
                  <td style="padding:8px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${COLOR.ink};font-weight:700;">Total</td>
                  <td style="padding:8px 0;text-align:right;font-size:22px;color:${COLOR.ink};font-weight:700;">${fmtMoney(vars.displayTotal)}</td>
                </tr>
                <tr>
                  <td colspan="2" style="border-top:2px solid ${COLOR.gold};padding-top:0;"></td>
                </tr>
              </table>
              <div style="clear:both;height:1px;line-height:1px;font-size:0;">&nbsp;</div>
            </td>
          </tr>
          ${vars.razorpayPaymentId ? `
          <!-- Payment ref -->
          <tr>
            <td style="padding:18px 36px 0 36px;">
              <div style="font-size:12px;color:${COLOR.inkMute};">Payment reference: ${escapeHtml(vars.razorpayPaymentId)}</div>
            </td>
          </tr>` : ''}
          <!-- Invoice CTA -->
          <tr>
            <td style="padding:28px 36px 28px 36px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-right:8px;">
                    <a href="${escapeHtml(viewInvoiceUrl)}" style="display:inline-block;background:${COLOR.ink};color:${COLOR.paper};text-decoration:none;font-size:13px;font-weight:600;letter-spacing:0.04em;padding:12px 22px;border-radius:999px;">View invoice</a>
                  </td>
                  <td>
                    <a href="${escapeHtml(viewInvoiceUrl)}" style="display:inline-block;background:transparent;color:${COLOR.ink};text-decoration:none;font-size:13px;font-weight:600;letter-spacing:0.04em;padding:12px 22px;border:1px solid ${COLOR.ink};border-radius:999px;">Download PDF</a>
                  </td>
                </tr>
              </table>
              <div style="font-size:12px;color:${COLOR.inkMute};margin-top:14px;">A copy of the same invoice is also attached to this email.</div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 36px 32px 36px;border-top:1px solid ${COLOR.rule};">
              <div style="font-size:12px;color:${COLOR.inkSoft};line-height:1.55;">
                Need anything? Reply to this email or write to
                <a href="mailto:studio@srilatha.art" style="color:${COLOR.ink};">studio@srilatha.art</a>.
                You can also see your order any time at
                <a href="${escapeHtml(accountOrderUrl)}" style="color:${COLOR.ink};">your account</a>.
              </div>
              <div style="font-size:11px;color:${COLOR.inkMute};margin-top:14px;">
                Srilatha Art &middot; Hyderabad, India<br/>
                You're receiving this email because you placed an order with Srilatha Art.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  // Plain-text fallback for clients that prefer it (and for spam filters
  // that downgrade html-only mail).
  const text = [
    `Thank you, ${vars.customerName}.`,
    ``,
    `Your order ${vars.orderId} has been confirmed.`,
    `Date: ${fmtDate(vars.createdAt)}`,
    `Status: ${vars.paymentStatus.toLowerCase() === 'captured' ? 'Paid' : vars.paymentStatus}`,
    vars.razorpayPaymentId ? `Payment ref: ${vars.razorpayPaymentId}` : '',
    ``,
    `Items`,
    ...vars.items.map(
      (it) => `  - ${it.title}  x${it.qty}  ${fmtMoney(it.displayPrice * it.qty)}`,
    ),
    ``,
    typeof vars.subtotal === 'number' ? `Subtotal:  ${fmtMoney(vars.subtotal / 100)}` : '',
    typeof vars.shippingAmount === 'number'
      ? `Shipping:  ${vars.shippingAmount > 0 ? fmtMoney(vars.shippingAmount / 100) : 'Free'}`
      : '',
    typeof vars.discountAmount === 'number' && vars.discountAmount > 0
      ? `Discount:  -${fmtMoney(vars.discountAmount / 100)}`
      : '',
    `Total:     ${fmtMoney(vars.displayTotal)}`,
    ``,
    `Invoice:   ${viewInvoiceUrl}`,
    `Account:   ${accountOrderUrl}`,
    ``,
    `Questions? Reply to this email or write to studio@srilatha.art.`,
    `— Srilatha Art`,
  ]
    .filter((l) => l !== '')
    .join('\n')

  return { subject, html, text }
}
