// Real, downloadable, text-searchable invoice PDF.
//
// Built with jsPDF + jspdf-autotable. Lazy-imported by callers so the
// ~150KB library only loads when the customer actually clicks Download —
// not on every page that links to an invoice. Mirrors the on-screen
// layout from InvoiceClient.tsx (header / billing-shipping / items table
// / totals / footer) so customers see the same document they download.

import { STUDIO_EMAIL, PHONE_DISPLAY, WEBSITE_URL } from './site-config'
import { formatINR } from './format'

export interface InvoiceOrder {
  id: string
  status: string
  paymentStatus: string
  displayTotal: number
  subtotal?: number
  shippingAmount?: number
  discountAmount?: number
  couponCode?: string
  customerName: string
  customerEmail?: string
  customerPhone?: string
  shippingAddress?: {
    fullName?: string
    phone?: string
    line1?: string
    line2?: string
    city?: string
    state?: string
    pincode?: string
    country?: string
  }
  razorpayPaymentId?: string
  createdAt: string
}

export interface InvoiceItem {
  productId: string
  title: string
  category: string
  displayPrice: number
  qty: number
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

// formatINR returns "₹ 1,234" with the rupee glyph. jsPDF's default Helvetica
// font has no glyph for U+20B9, so it renders as a tofu box. We swap to "Rs."
// for the PDF — clearer in print and universally renderable. Could be replaced
// later by embedding a Unicode font, but that adds ~300KB.
function fmtMoney(rs: number): string {
  return formatINR(rs).replace(/^\s*₹\s*/, 'Rs. ')
}

/**
 * Build and trigger download of an invoice PDF.
 * Returns a promise that resolves once the save dialog is invoked.
 */
export async function downloadInvoicePdf(
  order: InvoiceOrder,
  items: InvoiceItem[],
): Promise<void> {
  // Lazy-load the heavy deps so they're only fetched when the user clicks.
  const [{ jsPDF }, autoTableMod] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const autoTable = (autoTableMod.default || autoTableMod) as (
    doc: InstanceType<typeof jsPDF>,
    options: Record<string, unknown>,
  ) => void

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 42

  // ── Brand colours (deep purple ink + lavender accent — matches site theme).
  const ink: [number, number, number] = [42, 30, 60]
  const inkSoft: [number, number, number] = [110, 100, 130]
  const inkMute: [number, number, number] = [150, 145, 165]
  const rule: [number, number, number] = [225, 220, 235]

  // ── Header row: brand on the left, invoice meta on the right ─────────
  let y = margin

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...ink)
  doc.setFontSize(22)
  doc.text('Srilatha Art', margin, y + 18)

  doc.setFontSize(9)
  doc.setTextColor(...inkMute)
  doc.text(WEBSITE_URL.replace(/^https?:\/\//, ''), margin, y + 34)
  doc.text(`${STUDIO_EMAIL}  ·  ${PHONE_DISPLAY}`, margin, y + 47)

  doc.setFontSize(9)
  doc.setTextColor(...inkMute)
  doc.text('INVOICE', pageW - margin, y + 14, { align: 'right' })

  doc.setFontSize(15)
  doc.setTextColor(...ink)
  doc.text(order.id, pageW - margin, y + 32, { align: 'right' })

  doc.setFontSize(9)
  doc.setTextColor(...inkMute)
  doc.text(`Dated ${fmtDate(order.createdAt)}`, pageW - margin, y + 46, {
    align: 'right',
  })

  const paidLabel =
    order.paymentStatus === 'PAID' ? 'PAID' : 'PAYMENT PENDING'
  doc.setTextColor(
    order.paymentStatus === 'PAID' ? 18 : 161,
    order.paymentStatus === 'PAID' ? 122 : 98,
    order.paymentStatus === 'PAID' ? 65 : 7,
  )
  doc.setFontSize(8)
  doc.text(paidLabel, pageW - margin, y + 60, { align: 'right' })

  y += 80
  drawRule(doc, margin, pageW - margin, y, rule)
  y += 18

  // ── Billed to / Ship to columns ─────────────────────────────────────
  const colW = (pageW - margin * 2 - 24) / 2
  const billedX = margin
  const shipX = margin + colW + 24

  doc.setFontSize(8)
  doc.setTextColor(...inkMute)
  doc.text('BILLED TO', billedX, y)
  doc.text('SHIP TO', shipX, y)

  doc.setFontSize(10)
  doc.setTextColor(...ink)
  doc.text(order.customerName || '', billedX, y + 16)

  const billLines: string[] = []
  if (order.customerEmail) billLines.push(order.customerEmail)
  if (order.customerPhone) billLines.push(order.customerPhone)
  doc.setTextColor(...inkSoft)
  doc.setFontSize(9)
  billLines.forEach((line, i) => doc.text(line, billedX, y + 30 + i * 12))

  const addr = order.shippingAddress || {}
  doc.setTextColor(...ink)
  doc.setFontSize(10)
  doc.text(addr.fullName || order.customerName || '', shipX, y + 16)

  const shipLines: string[] = []
  const street = [addr.line1, addr.line2].filter(Boolean).join(', ')
  if (street) shipLines.push(street)
  const cityLine = [addr.city, addr.state].filter(Boolean).join(', ')
  const cityPin = addr.pincode ? `${cityLine} ${addr.pincode}` : cityLine
  if (cityPin) shipLines.push(cityPin)
  if (addr.country) shipLines.push(addr.country)
  if (addr.phone) shipLines.push(addr.phone)

  doc.setTextColor(...inkSoft)
  doc.setFontSize(9)
  shipLines.forEach((line, i) => {
    const wrapped = doc.splitTextToSize(line, colW)
    wrapped.forEach((wl: string, j: number) => {
      doc.text(wl, shipX, y + 30 + (i + j) * 12)
    })
  })

  const colRows = Math.max(billLines.length, shipLines.length) + 1
  y += 30 + colRows * 12 + 8
  drawRule(doc, margin, pageW - margin, y, rule)
  y += 14

  // ── Items table ────────────────────────────────────────────────────
  const rows = items.length === 0
    ? [['No items recorded on this order.', '', '', '']]
    : items.map((it) => [
        // Compose item cell with title + category subtitle. autoTable
        // renders newlines, so we use a two-line cell.
        `${it.title}\n${(it.category || '').toUpperCase()}`,
        String(it.qty),
        fmtMoney(it.displayPrice),
        fmtMoney(it.displayPrice * it.qty),
      ])

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Item', 'Qty', 'Unit', 'Amount']],
    body: rows,
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 10,
      textColor: ink,
      cellPadding: { top: 8, bottom: 8, left: 0, right: 8 },
      lineColor: rule,
      lineWidth: 0,
    },
    headStyles: {
      fontSize: 8,
      textColor: inkMute,
      fontStyle: 'normal',
      cellPadding: { top: 0, bottom: 6, left: 0, right: 8 },
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'right', cellWidth: 40 },
      2: { halign: 'right', cellWidth: 70 },
      3: { halign: 'right', cellWidth: 80 },
    },
    didDrawCell: (data: {
      section: 'head' | 'body' | 'foot'
      column: { index: number }
      cell: { x: number; y: number; height: number }
      row: { index: number }
    }) => {
      // Bottom border per body row — matches the divide-y on screen.
      if (data.section === 'body' && data.column.index === 0) {
        const { y: cy, height } = data.cell
        doc.setDrawColor(...rule)
        doc.setLineWidth(0.5)
        doc.line(margin, cy + height, pageW - margin, cy + height)
      }
    },
  })

  // jspdf-autotable attaches the cursor on doc.lastAutoTable.
  type AutoTableDoc = InstanceType<typeof jsPDF> & {
    lastAutoTable?: { finalY: number }
  }
  y = ((doc as AutoTableDoc).lastAutoTable?.finalY ?? y) + 18

  // ── Totals (right-aligned block) ───────────────────────────────────
  const totalsX = pageW - margin - 220
  const valX = pageW - margin
  const lineH = 16

  const totalLines: Array<{ label: string; value: string; emph?: boolean }> = []
  if (typeof order.subtotal === 'number') {
    totalLines.push({
      label: 'Subtotal',
      value: fmtMoney(order.subtotal / 100),
    })
  }
  if (typeof order.shippingAmount === 'number') {
    totalLines.push({
      label: 'Shipping',
      value: order.shippingAmount > 0 ? fmtMoney(order.shippingAmount / 100) : 'Free',
    })
  }
  if (typeof order.discountAmount === 'number' && order.discountAmount > 0) {
    totalLines.push({
      label: `Discount${order.couponCode ? ` (${order.couponCode})` : ''}`,
      value: `- ${fmtMoney(order.discountAmount / 100)}`,
    })
  }

  doc.setFontSize(10)
  totalLines.forEach((row) => {
    doc.setTextColor(...inkSoft)
    doc.text(row.label, totalsX, y)
    doc.setTextColor(...ink)
    doc.text(row.value, valX, y, { align: 'right' })
    y += lineH
  })

  y += 4
  drawRule(doc, totalsX, valX, y, rule)
  y += 16
  doc.setFontSize(11)
  doc.setTextColor(...ink)
  doc.text('Total', totalsX, y)
  doc.setFontSize(14)
  doc.text(fmtMoney(order.displayTotal), valX, y, { align: 'right' })
  y += 14
  doc.setFontSize(8)
  doc.setTextColor(...inkMute)
  doc.text('Inclusive of all taxes.', valX, y, { align: 'right' })
  y += 28

  // ── Footer ────────────────────────────────────────────────────────
  drawRule(doc, margin, pageW - margin, y, rule)
  y += 14

  doc.setFontSize(8)
  doc.setTextColor(...inkMute)
  if (order.razorpayPaymentId) {
    doc.text(`Payment reference: ${order.razorpayPaymentId}`, margin, y)
    y += 12
  }
  const thanks =
    `Thank you for supporting handmade work. Questions about this invoice? ` +
    `Email ${STUDIO_EMAIL} or call ${PHONE_DISPLAY}.`
  doc.splitTextToSize(thanks, pageW - margin * 2).forEach((line: string) => {
    doc.text(line, margin, y)
    y += 12
  })
  doc.text(
    'This invoice is generated electronically and is valid without signature.',
    margin,
    y,
  )

  doc.save(`invoice-${order.id}.pdf`)
}

function drawRule(
  doc: { setDrawColor: (r: number, g: number, b: number) => void; setLineWidth: (w: number) => void; line: (x1: number, y1: number, x2: number, y2: number) => void },
  x1: number,
  x2: number,
  y: number,
  color: [number, number, number],
): void {
  doc.setDrawColor(color[0], color[1], color[2])
  doc.setLineWidth(0.5)
  doc.line(x1, y, x2, y)
}
