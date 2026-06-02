// Real, downloadable, text-searchable invoice PDF.
//
// Built with jsPDF + jspdf-autotable. Lazy-imported by callers so the
// ~150KB library only loads when the customer actually clicks Download -
// not on every page that links to an invoice. Mirrors the on-screen
// layout from InvoiceClient.tsx (gold trim → letterhead header →
// parties → items → dominant total → studio-letter footer) so the
// document the customer downloads matches the one they see.

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
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

// formatINR returns "₹ 1,234" with the rupee glyph. jsPDF's default Helvetica
// font has no glyph for U+20B9, so it renders as a tofu box. We swap to "Rs."
// for the PDF - clearer in print and universally renderable. Could be replaced
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
  const margin = 48

  // ── Brand palette - mirrors --text / --accent / --accent-strong in
  // frontend/app/globals.css :root. The pill colours match the on-screen
  // badge styling so the screen and PDF feel like one document.
  const ink: [number, number, number] = [34, 27, 18]
  const inkSoft: [number, number, number] = [67, 57, 46]
  const inkMute: [number, number, number] = [138, 126, 110]
  const rule: [number, number, number] = [225, 219, 207]
  const gold: [number, number, number] = [200, 150, 47]
  const goldDeep: [number, number, number] = [138, 106, 26]

  // ── Gold letterhead trim across the very top of the page ───────────
  doc.setFillColor(...gold)
  doc.rect(0, 0, pageW, 4, 'F')

  let y = margin + 4

  // ── Header row: brand block (left) vs. invoice meta (right) ────────
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...ink)
  doc.setFontSize(20)
  doc.text('SRILATHA ART', margin, y + 8)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...goldDeep)
  doc.text(
    'HANDCRAFTED ART & CUSTOM CREATIONS',
    margin,
    y + 22,
    { charSpace: 1.2 },
  )

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...inkSoft)
  const website = WEBSITE_URL.replace(/^https?:\/\//, '').replace(/^www\./i, '')
  doc.text(website, margin, y + 38)
  doc.text(STUDIO_EMAIL, margin, y + 50)
  doc.text(PHONE_DISPLAY, margin, y + 62)

  // ── Right column: oversized INVOICE wordmark + meta + status pill ──
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(34)
  doc.setTextColor(...ink)
  doc.text('INVOICE', pageW - margin, y + 16, {
    align: 'right',
    charSpace: 2.5,
  })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...inkMute)
  doc.text('INVOICE NO.', pageW - margin, y + 30, {
    align: 'right',
    charSpace: 1.1,
  })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...ink)
  doc.text(order.id, pageW - margin, y + 42, { align: 'right' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...inkMute)
  doc.text('ISSUED', pageW - margin, y + 56, {
    align: 'right',
    charSpace: 1.1,
  })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...ink)
  doc.text(fmtDate(order.createdAt), pageW - margin, y + 68, {
    align: 'right',
  })

  // ── Status pill - filled rounded rect with a small dot + label ─────
  drawStatusPill(doc, order.paymentStatus, pageW - margin, y + 82)

  y += 100

  // ── Editorial gold rule ───────────────────────────────────────────
  drawGoldRule(doc, margin, pageW - margin, y, gold, goldDeep)
  y += 24

  // ── Billed to / Ship to columns ───────────────────────────────────
  const colW = (pageW - margin * 2 - 32) / 2
  const billedX = margin
  const shipX = margin + colW + 32

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...inkMute)
  doc.text('BILLED TO', billedX, y, { charSpace: 1.4 })
  doc.text('SHIP TO', shipX, y, { charSpace: 1.4 })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...ink)
  doc.text(order.customerName || '', billedX, y + 18)

  const billLines: string[] = []
  if (order.customerEmail) billLines.push(order.customerEmail)
  if (order.customerPhone) billLines.push(order.customerPhone)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...inkSoft)
  doc.setFontSize(9.5)
  billLines.forEach((line, i) => doc.text(line, billedX, y + 34 + i * 13))

  const addr = order.shippingAddress || {}
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...ink)
  doc.setFontSize(11)
  doc.text(addr.fullName || order.customerName || '', shipX, y + 18)

  const shipLines: string[] = []
  const street = [addr.line1, addr.line2].filter(Boolean).join(', ')
  if (street) shipLines.push(street)
  const cityLine = [addr.city, addr.state].filter(Boolean).join(', ')
  const cityPin = addr.pincode ? `${cityLine} ${addr.pincode}` : cityLine
  if (cityPin) shipLines.push(cityPin)
  if (addr.country) shipLines.push(addr.country)
  if (addr.phone) shipLines.push(addr.phone)

  // Flatten source lines through splitTextToSize FIRST so we have a single
  // ordered list of visual rows, then paint each at its own y. Indexing by
  // source line collides when a long street wraps onto two visual rows -
  // the second wrapped row landed on top of the next source line (city/
  // pincode), producing an overlapping smear in earlier versions.
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...inkSoft)
  doc.setFontSize(9.5)
  const shipVisualLines: string[] = shipLines.flatMap((line) =>
    doc.splitTextToSize(line, colW) as string[],
  )
  shipVisualLines.forEach((line, i) => {
    doc.text(line, shipX, y + 34 + i * 13)
  })

  const colRows = Math.max(billLines.length, shipVisualLines.length) + 1
  y += 34 + colRows * 13 + 18

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
    head: [['ITEM', 'QTY', 'UNIT', 'AMOUNT']],
    body: rows,
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 10,
      textColor: ink,
      cellPadding: { top: 11, bottom: 11, left: 0, right: 8 },
      lineColor: rule,
      lineWidth: 0,
      valign: 'middle',
    },
    headStyles: {
      fontSize: 7.5,
      textColor: inkMute,
      fontStyle: 'bold',
      cellPadding: { top: 4, bottom: 10, left: 0, right: 8 },
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'right', cellWidth: 40 },
      2: { halign: 'right', cellWidth: 75 },
      3: { halign: 'right', cellWidth: 85, fontStyle: 'bold' },
    },
    didDrawCell: (data: {
      section: 'head' | 'body' | 'foot'
      column: { index: number }
      cell: { x: number; y: number; height: number }
      row: { index: number }
    }) => {
      // Top border on the header row (above ITEM/QTY/UNIT/AMOUNT)
      // and a bottom border per body row to mirror the divide-y on screen.
      if (data.section === 'head' && data.column.index === 0) {
        const { y: cy } = data.cell
        doc.setDrawColor(...ink)
        doc.setLineWidth(0.6)
        doc.line(margin, cy, pageW - margin, cy)
      }
      if (data.section === 'body' && data.column.index === 0) {
        const { y: cy, height } = data.cell
        doc.setDrawColor(...rule)
        doc.setLineWidth(0.4)
        doc.line(margin, cy + height, pageW - margin, cy + height)
      }
    },
  })

  // jspdf-autotable attaches the cursor on doc.lastAutoTable.
  type AutoTableDoc = InstanceType<typeof jsPDF> & {
    lastAutoTable?: { finalY: number }
  }
  y = ((doc as AutoTableDoc).lastAutoTable?.finalY ?? y) + 24

  // ── Totals (right-aligned block) ───────────────────────────────────
  const totalsX = pageW - margin - 240
  const valX = pageW - margin
  const lineH = 16

  const totalLines: Array<{ label: string; value: string }> = []
  if (typeof order.subtotal === 'number') {
    totalLines.push({
      label: 'Subtotal',
      value: fmtMoney(order.subtotal / 100),
    })
  }
  if (typeof order.shippingAmount === 'number') {
    totalLines.push({
      label: 'Shipping',
      value: order.shippingAmount > 0
        ? fmtMoney(order.shippingAmount / 100)
        : 'Free',
    })
  }
  if (typeof order.discountAmount === 'number' && order.discountAmount > 0) {
    totalLines.push({
      label: `Discount${order.couponCode ? ` (${order.couponCode})` : ''}`,
      value: `- ${fmtMoney(order.discountAmount / 100)}`,
    })
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  totalLines.forEach((row) => {
    doc.setTextColor(...inkSoft)
    doc.text(row.label, totalsX, y)
    doc.setTextColor(...ink)
    doc.text(row.value, valX, y, { align: 'right' })
    y += lineH
  })

  // Hairline above the Total row + dominant Total + gold underline.
  y += 6
  doc.setDrawColor(...ink)
  doc.setLineWidth(0.6)
  doc.line(totalsX, y, valX, y)
  y += 20

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...ink)
  doc.text('TOTAL', totalsX, y, { charSpace: 1.6 })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text(fmtMoney(order.displayTotal), valX, y + 2, { align: 'right' })

  // Gold underline beneath the Total amount.
  doc.setDrawColor(...gold)
  doc.setLineWidth(1.6)
  doc.line(valX - 56, y + 8, valX, y + 8)

  y += 22
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...inkMute)
  doc.text('Inclusive of all taxes.', valX, y, { align: 'right' })
  y += 34

  // ── Footer ────────────────────────────────────────────────────────
  doc.setDrawColor(...rule)
  doc.setLineWidth(0.5)
  doc.line(margin, y, pageW - margin, y)
  y += 22

  if (order.razorpayPaymentId) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...inkMute)
    doc.text(
      `Payment reference: ${order.razorpayPaymentId}`,
      margin,
      y,
    )
    y += 18
  }

  // Studio-letter thank-you. Headline in italic-style serif feel comes
  // closest in Helvetica via a slightly larger size + the brand
  // hierarchy below it.
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...ink)
  doc.text('Thank you for supporting handcrafted art.', margin, y)
  y += 16

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...inkSoft)
  const bodyMsg =
    'Each piece is individually designed and handmade in our Hyderabad studio.'
  doc.splitTextToSize(bodyMsg, pageW - margin * 2).forEach((line: string) => {
    doc.text(line, margin, y)
    y += 13
  })

  y += 14
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...inkMute)
  doc.text('QUESTIONS?', margin, y, { charSpace: 1.4 })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...inkSoft)
  doc.text(STUDIO_EMAIL, margin + 84, y)
  doc.text(PHONE_DISPLAY, margin + 84, y + 13)
  doc.text(website, margin + 84, y + 26)
  y += 44

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...inkMute)
  doc.text(
    'This invoice is generated electronically and is valid without signature.',
    margin,
    y,
    { charSpace: 0.6 },
  )

  doc.save(`invoice-${order.id}.pdf`)
}

// Filled rounded-corner status pill, right-anchored at (rightX, y).
// Mirrors the on-screen TONE_CLASSES badge in InvoiceClient.tsx.
function drawStatusPill(
  doc: InstanceType<
    typeof import('jspdf').jsPDF
  >,
  paymentStatus: string,
  rightX: number,
  y: number,
): void {
  const s = (paymentStatus || '').toUpperCase()
  const isPaid = s === 'PAID'
  const isRefund = s === 'REFUNDED'
  const label = isPaid ? 'PAID' : isRefund ? 'REFUNDED' : 'PAYMENT PENDING'

  // bg / text / dot - tuned to AA on ivory.
  const fill: [number, number, number] = isPaid
    ? [236, 253, 245]  // emerald-50
    : isRefund
    ? [241, 245, 249]  // slate-100
    : [255, 251, 235]  // amber-50
  const stroke: [number, number, number] = isPaid
    ? [167, 243, 208]  // emerald-200
    : isRefund
    ? [203, 213, 225]  // slate-200
    : [253, 230, 138]  // amber-200
  const textRgb: [number, number, number] = isPaid
    ? [6, 95, 70]      // emerald-800
    : isRefund
    ? [51, 65, 85]     // slate-700
    : [120, 53, 15]    // amber-900
  const dotRgb: [number, number, number] = isPaid
    ? [16, 185, 129]   // emerald-500
    : isRefund
    ? [148, 163, 184]  // slate-400
    : [245, 158, 11]   // amber-500

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  const textW = doc.getTextWidth(label)
  const padX = 9
  const dotR = 1.6
  const dotGap = 5
  const pillW = padX + dotR * 2 + dotGap + textW + padX
  const pillH = 18
  const x = rightX - pillW
  const r = pillH / 2

  doc.setFillColor(...fill)
  doc.setDrawColor(...stroke)
  doc.setLineWidth(0.6)
  doc.roundedRect(x, y - pillH + 4, pillW, pillH, r, r, 'FD')

  // Dot
  doc.setFillColor(...dotRgb)
  doc.circle(x + padX + dotR, y - pillH / 2 + 4, dotR, 'F')

  // Label
  doc.setTextColor(...textRgb)
  doc.text(label, x + padX + dotR * 2 + dotGap, y - 2)
}

// Editorial gold rule - solid fade across the page, mirrors the
// CSS .invoice-rule gradient on screen.
function drawGoldRule(
  doc: {
    setDrawColor: (r: number, g: number, b: number) => void
    setLineWidth: (w: number) => void
    line: (x1: number, y1: number, x2: number, y2: number) => void
  },
  x1: number,
  x2: number,
  y: number,
  gold: [number, number, number],
  goldDeep: [number, number, number],
): void {
  // jsPDF lacks true gradients on strokes; we approximate the on-screen
  // gradient with three concentric segments - light edges, deep middle.
  const seg = (x2 - x1) / 4
  doc.setLineWidth(0.6)
  doc.setDrawColor(...gold)
  doc.line(x1, y, x1 + seg, y)
  doc.setDrawColor(...goldDeep)
  doc.line(x1 + seg, y, x1 + seg * 3, y)
  doc.setDrawColor(...gold)
  doc.line(x1 + seg * 3, y, x2, y)
}
