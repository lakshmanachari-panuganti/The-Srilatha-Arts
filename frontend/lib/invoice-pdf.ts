// Real, downloadable, text-searchable invoice PDF.
//
// Built with jsPDF + jspdf-autotable. Lazy-imported by callers so the
// ~150KB library only loads when the customer actually clicks Download -
// not on every page that links to an invoice.
//
// Visual brief (matches InvoiceClient.tsx on-screen sheet so the
// downloaded and viewed documents read as one artefact):
//
//   gold trim
//   ┌──────────────────────────────────────────────┐
//   │ [LOGO]  SRILATHA ART          INVOICE         │
//   │         tagline               # / date         │
//   │         contact lines         [status pill]    │
//   │ ─────── editorial gold rule ─────────          │
//   │ BILLED TO              SHIP TO                 │
//   │   …                       …                    │
//   │ ITEM ........... QTY  UNIT     AMOUNT          │
//   │  [thumb] Title                                  │
//   │          COLLECTION                             │
//   │                                                 │
//   │                          Subtotal      Rs. X    │
//   │                          Shipping      Rs. X    │
//   │                          ──────────────         │
//   │                          TOTAL         Rs. X    │
//   │                          ░░░░ (gold)            │
//   │                                                 │
//   │ Thank you for supporting handcrafted art.       │
//   │ Every piece from Srilatha Art …                 │
//   │ QUESTIONS?  studio@…                            │
//   │             +91 …                               │
//   │             srilatha.art                        │
//   │ ─────────────────────────────────               │
//   │ This invoice is generated electronically…       │
//   └──────────────────────────────────────────────┘

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
  imageUrl?: string
  displayPrice: number
  qty: number
}

// ── Brand palette (mirrors frontend/app/globals.css :root) ──────────
const INK: RGB = [34, 27, 18]
const INK_SOFT: RGB = [67, 57, 46]
const INK_MUTE: RGB = [138, 126, 110]
const RULE: RGB = [225, 219, 207]
const GOLD: RGB = [184, 138, 45]      // #B88A2D - spec-asked accent
const GOLD_DEEP: RGB = [138, 106, 26] // --accent-strong
const PAPER: RGB = [253, 252, 248]

type RGB = [number, number, number]

const LOGO_URL = '/Logos/logo.png'

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

interface LoadedImage {
  dataUrl: string
  format: 'PNG' | 'JPEG'
  w: number
  h: number
}

// Fetch + canvas-downsize an image so the PDF embeds a small artefact
// instead of the original 2000-px product photo. PNG preserves alpha
// (needed for the logo); JPEG used for thumbnails to keep file size down.
// Returns null on any failure (CORS, 404, decode error) so the layout
// can fall back to a placeholder block without aborting the whole PDF.
async function loadImage(
  url: string,
  opts: { maxDim: number; format: 'PNG' | 'JPEG' },
): Promise<LoadedImage | null> {
  if (!url) return null
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.crossOrigin = 'anonymous'
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('decode'))
      i.src = url
    })
    const nw = img.naturalWidth || img.width
    const nh = img.naturalHeight || img.height
    if (!nw || !nh) return null
    const ratio = Math.min(1, opts.maxDim / Math.max(nw, nh))
    const w = Math.max(1, Math.round(nw * ratio))
    const h = Math.max(1, Math.round(nh * ratio))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    // White matte under JPEGs so transparent thumbnails don't render
    // black behind the picture.
    if (opts.format === 'JPEG') {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
    }
    ctx.drawImage(img, 0, 0, w, h)
    const dataUrl =
      opts.format === 'PNG'
        ? canvas.toDataURL('image/png')
        : canvas.toDataURL('image/jpeg', 0.82)
    return { dataUrl, format: opts.format, w, h }
  } catch {
    return null
  }
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

  // Preload logo + product thumbnails in parallel before we draw anything.
  // Resolving these first keeps the table-render path synchronous and lets
  // autoTable measure its own row heights without us blocking inside its
  // didDrawCell callback (which doesn't support async).
  const [logo, thumbs] = await Promise.all([
    loadImage(LOGO_URL, { maxDim: 240, format: 'PNG' }),
    Promise.all(
      items.map((it) =>
        it.imageUrl
          ? loadImage(it.imageUrl, { maxDim: 160, format: 'JPEG' })
          : Promise.resolve(null),
      ),
    ),
  ])

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 48

  // ── Gold letterhead trim across the very top of the page ─────────
  doc.setFillColor(...GOLD)
  doc.rect(0, 0, pageW, 4, 'F')

  // Subtle warm paper tint behind the sheet - extremely soft so it
  // reads as off-white only against a stark printer-white background.
  doc.setFillColor(...PAPER)
  doc.rect(0, 4, pageW, pageH - 4, 'F')

  let y = margin + 4

  // ── Header: brand block (left) vs. invoice meta (right) ──────────
  // Logo bumped ~18% (52 → 62pt) for better balance with the 34pt
  // INVOICE wordmark on the right. Tagline removed per brief - the
  // wordmark + contact lines do the work alone.
  const logoSize = 62
  const brandTextX = logo ? margin + logoSize + 16 : margin

  if (logo) {
    doc.addImage(
      logo.dataUrl,
      logo.format,
      margin,
      y - 2,
      logoSize,
      logoSize,
      undefined,
      'FAST',
    )
  }

  // Srilatha Art wordmark. The on-screen site uses Pramukh Rounded
  // (font-brand). jsPDF ships only the 14 PDF base fonts, so the
  // closest tonal match here is bold Helvetica with slightly wider
  // tracking. Embedding Pramukh Rounded would add ~150KB to the lazy
  // chunk for a single line of brand text; not worth the cost.
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...INK)
  doc.setFontSize(22)
  doc.text('Srilatha Art', brandTextX, y + 18, { charSpace: 0.6 })

  // Contact lines - tightened directly under the wordmark with no
  // tagline gap between them.
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...INK_SOFT)
  const website = WEBSITE_URL.replace(/^https?:\/\//, '').replace(/^www\./i, '')
  doc.text(website, brandTextX, y + 34)
  doc.text(STUDIO_EMAIL, brandTextX, y + 46)
  doc.text(PHONE_DISPLAY, brandTextX, y + 58)

  // ── Right column: oversized INVOICE wordmark + meta + status pill ─
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(34)
  doc.setTextColor(...INK)
  doc.text('INVOICE', pageW - margin, y + 18, {
    align: 'right',
    charSpace: 2.6,
  })

  // Short gold underline under INVOICE - matches the gold underline
  // beneath TOTAL further down.
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(1.6)
  doc.line(pageW - margin - 56, y + 26, pageW - margin, y + 26)

  // Single-line metadata rows: "Invoice No: <id>" and "Issued: <date>".
  // Label set in muted weight, value in ink. Right-anchored so the
  // value's right edge aligns with the page margin.
  const metaLabelY = y + 42
  const metaIssuedY = y + 56

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  // Invoice No row - paint value first (right-anchored), then prepend
  // the label so we know exactly where to start the label.
  doc.setTextColor(...INK)
  const idText = order.id
  doc.text(idText, pageW - margin, metaLabelY, { align: 'right' })
  const idW = doc.getTextWidth(idText)
  doc.setTextColor(...INK_MUTE)
  doc.text('Invoice No:', pageW - margin - idW - 4, metaLabelY, {
    align: 'right',
  })

  // Issued row - same approach.
  doc.setTextColor(...INK)
  const dateText = fmtDate(order.createdAt)
  doc.text(dateText, pageW - margin, metaIssuedY, { align: 'right' })
  const dateW = doc.getTextWidth(dateText)
  doc.setTextColor(...INK_MUTE)
  doc.text('Issued:', pageW - margin - dateW - 4, metaIssuedY, {
    align: 'right',
  })

  // Status pill - tightened gap (was 100 → 78) so the right column
  // doesn't drift below the left block.
  drawStatusPill(doc, order.paymentStatus, pageW - margin, y + 78)

  y += 96

  // ── Editorial gold rule ─────────────────────────────────────────
  drawGoldRule(doc, margin, pageW - margin, y)
  y += 26

  // ── Billed to / Ship to columns ─────────────────────────────────
  const colW = (pageW - margin * 2 - 32) / 2
  const billedX = margin
  const shipX = margin + colW + 32

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...INK_MUTE)
  doc.text('BILLED TO', billedX, y, { charSpace: 1.5 })
  doc.text('SHIP TO', shipX, y, { charSpace: 1.5 })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11.5)
  doc.setTextColor(...INK)
  doc.text(order.customerName || '', billedX, y + 18)

  const billLines: string[] = []
  if (order.customerEmail) billLines.push(order.customerEmail)
  if (order.customerPhone) billLines.push(order.customerPhone)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...INK_SOFT)
  doc.setFontSize(9.5)
  billLines.forEach((line, i) => doc.text(line, billedX, y + 34 + i * 13))

  const addr = order.shippingAddress || {}
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...INK)
  doc.setFontSize(11.5)
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
  doc.setTextColor(...INK_SOFT)
  doc.setFontSize(9.5)
  const shipVisualLines: string[] = shipLines.flatMap((line) =>
    doc.splitTextToSize(line, colW) as string[],
  )
  shipVisualLines.forEach((line, i) => {
    doc.text(line, shipX, y + 34 + i * 13)
  })

  const colRows = Math.max(billLines.length, shipVisualLines.length) + 1
  y += 34 + colRows * 13 + 22

  // ── Items table ────────────────────────────────────────────────
  //
  // First column reserves ~52pt of left padding so the row title sits
  // beside (not on top of) the product thumbnail painted in didDrawCell.
  // autoTable still owns row sizing + page breaks, which is the whole
  // reason to keep it instead of hand-drawing the rows.
  const THUMB_PX = 38
  const THUMB_GAP = 10
  const THUMB_PAD_LEFT = 4
  const FIRST_COL_LEFT_PAD = THUMB_PAD_LEFT + THUMB_PX + THUMB_GAP

  const rows = items.length === 0
    ? [['No items recorded on this order.', '', '', '']]
    : items.map((it) => [
        // Two-line cell: title on row 1, collection eyebrow on row 2.
        `${it.title}\nCOLLECTION: ${(it.category || 'Custom').toUpperCase()}`,
        String(it.qty),
        fmtMoney(it.displayPrice),
        fmtMoney(it.displayPrice * it.qty),
      ])

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin, top: margin, bottom: margin + 24 },
    head: [['ITEM', 'QTY', 'UNIT', 'AMOUNT']],
    body: rows,
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 10,
      textColor: INK,
      cellPadding: { top: 12, bottom: 12, left: 0, right: 8 },
      lineColor: RULE,
      lineWidth: 0,
      valign: 'middle',
      minCellHeight: THUMB_PX + 12,
    },
    headStyles: {
      fontSize: 7.5,
      textColor: INK_MUTE,
      fontStyle: 'bold',
      cellPadding: { top: 4, bottom: 10, left: 0, right: 8 },
      minCellHeight: 0,
    },
    columnStyles: {
      0: { cellWidth: 'auto', cellPadding: { top: 12, bottom: 12, left: FIRST_COL_LEFT_PAD, right: 8 } },
      1: { halign: 'right', cellWidth: 40 },
      2: { halign: 'right', cellWidth: 75 },
      3: { halign: 'right', cellWidth: 85, fontStyle: 'bold' },
    },
    didParseCell: (data: {
      section: 'head' | 'body' | 'foot'
      column: { index: number }
      row: { index: number }
      cell: { styles: { fontSize: number; textColor?: RGB; fontStyle?: string } }
    }) => {
      // Make the second line of the item cell (the COLLECTION eyebrow)
      // smaller and muted. autoTable doesn't expose per-line styles,
      // so we lean on a smaller overall size + the tracking we baked
      // into the title via uppercase + " · " separators.
      if (data.section === 'body' && data.column.index === 0) {
        data.cell.styles.fontSize = 10
      }
    },
    didDrawCell: (data: {
      section: 'head' | 'body' | 'foot'
      column: { index: number }
      cell: { x: number; y: number; width: number; height: number }
      row: { index: number }
    }) => {
      // Top border on the header row.
      if (data.section === 'head' && data.column.index === 0) {
        const { y: cy } = data.cell
        doc.setDrawColor(...INK)
        doc.setLineWidth(0.6)
        doc.line(margin, cy, pageW - margin, cy)
      }
      // Bottom hairline + thumbnail per body row.
      if (data.section === 'body' && data.column.index === 0) {
        const { x: cx, y: cy, height } = data.cell
        // Hairline under the row.
        doc.setDrawColor(...RULE)
        doc.setLineWidth(0.4)
        doc.line(margin, cy + height, pageW - margin, cy + height)

        // Thumbnail (or quiet placeholder if no image / failed load).
        const thumb = thumbs[data.row.index]
        const tx = cx + THUMB_PAD_LEFT
        const ty = cy + (height - THUMB_PX) / 2
        if (thumb) {
          doc.addImage(
            thumb.dataUrl,
            thumb.format,
            tx,
            ty,
            THUMB_PX,
            THUMB_PX,
            undefined,
            'FAST',
          )
          // Hairline frame around the thumb so it sits properly on the page.
          doc.setDrawColor(...RULE)
          doc.setLineWidth(0.4)
          doc.rect(tx, ty, THUMB_PX, THUMB_PX, 'S')
        } else if (items.length > 0) {
          // Quiet placeholder square - reads as "image unavailable" without
          // shouting. Skipped on the empty-state row.
          doc.setFillColor(...PAPER)
          doc.setDrawColor(...RULE)
          doc.setLineWidth(0.4)
          doc.rect(tx, ty, THUMB_PX, THUMB_PX, 'FD')
        }
      }
    },
  })

  // jspdf-autotable attaches the cursor on doc.lastAutoTable.
  type AutoTableDoc = InstanceType<typeof jsPDF> & {
    lastAutoTable?: { finalY: number }
  }
  y = ((doc as AutoTableDoc).lastAutoTable?.finalY ?? y) + 26

  // ── Totals + Footer height check ──────────────────────────────
  // Estimate the totals + footer block height and push to a new page if
  // it wouldn't fit. Keeps the Total + thank-you intact on one final
  // page even if the items table wrapped right to the bottom.
  const totalsBlockH = estimateTotalsAndFooterHeight(order)
  if (y + totalsBlockH > pageH - margin) {
    doc.addPage()
    // Repaint trim + paper tint on the new page.
    doc.setFillColor(...GOLD)
    doc.rect(0, 0, pageW, 4, 'F')
    doc.setFillColor(...PAPER)
    doc.rect(0, 4, pageW, pageH - 4, 'F')
    y = margin + 4
  }

  // ── Totals (right-aligned block) ──────────────────────────────
  const totalsX = pageW - margin - 240
  const valX = pageW - margin
  const lineH = 17

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
    doc.setTextColor(...INK_SOFT)
    doc.text(row.label, totalsX, y)
    doc.setTextColor(...INK)
    doc.text(row.value, valX, y, { align: 'right' })
    y += lineH
  })

  // Hairline above + dominant TOTAL row + gold underline.
  y += 6
  doc.setDrawColor(...INK)
  doc.setLineWidth(0.6)
  doc.line(totalsX, y, valX, y)
  y += 24

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...INK)
  doc.text('TOTAL', totalsX, y, { charSpace: 1.8 })
  doc.setFontSize(22)
  doc.text(fmtMoney(order.displayTotal), valX, y + 2, { align: 'right' })

  doc.setDrawColor(...GOLD)
  doc.setLineWidth(1.8)
  doc.line(valX - 70, y + 9, valX, y + 9)

  y += 24
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...INK_MUTE)
  doc.text('Inclusive of all.', valX, y, { align: 'right' })
  y += 38

  // ── Footer: warm artisan note + legal small print ─────────────
  doc.setDrawColor(...RULE)
  doc.setLineWidth(0.5)
  doc.line(margin, y, pageW - margin, y)
  y += 24

  if (order.razorpayPaymentId) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...INK_MUTE)
    doc.text(
      `Payment reference: ${order.razorpayPaymentId}`,
      margin,
      y,
    )
    y += 18
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...INK)
  doc.text('Thank you for supporting handcrafted art.', margin, y)
  y += 17

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...INK_SOFT)
  const bodyMsg =
    'Every piece from Srilatha Art is individually designed and handmade in our Hyderabad studio.'
  doc.splitTextToSize(bodyMsg, pageW - margin * 2).forEach((line: string) => {
    doc.text(line, margin, y)
    y += 14
  })

  y += 14
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...INK_MUTE)
  doc.text('QUESTIONS?', margin, y, { charSpace: 1.4 })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...INK_SOFT)
  doc.text(STUDIO_EMAIL, margin + 88, y)
  doc.text(PHONE_DISPLAY, margin + 88, y + 14)
  doc.text(website, margin + 88, y + 28)
  y += 48

  // Legally required small print - smaller font, muted colour.
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...INK_MUTE)
  doc.text(
    'This invoice is generated electronically and is valid without signature.',
    margin,
    y,
    { charSpace: 0.6 },
  )

  doc.save(`invoice-${order.id}.pdf`)
}

// Rough height estimate for the totals + footer block. Used only to
// decide whether to break to a new page after the items table. A small
// over-estimate is fine - false breaks waste paper but false overflows
// chop the Thank You note.
function estimateTotalsAndFooterHeight(order: InvoiceOrder): number {
  let h = 0
  // Totals rows
  if (typeof order.subtotal === 'number') h += 17
  if (typeof order.shippingAmount === 'number') h += 17
  if (typeof order.discountAmount === 'number' && order.discountAmount > 0) h += 17
  // Total row + gold underline + "inclusive of all"
  h += 6 + 24 + 24 + 38
  // Footer hairline + payment ref + thank-you + body + Q block + legal
  h += 24
  if (order.razorpayPaymentId) h += 18
  h += 17 + 14 * 2 + 14 + 48 + 18
  return h
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

  // bg / stroke / text / dot - tuned to AA on ivory.
  const fill: RGB = isPaid
    ? [236, 253, 245]  // emerald-50
    : isRefund
    ? [241, 245, 249]  // slate-100
    : [255, 247, 224]  // light gold
  const stroke: RGB = isPaid
    ? [167, 243, 208]  // emerald-200
    : isRefund
    ? [203, 213, 225]  // slate-200
    : [232, 194, 90]   // light gold ring
  const textRgb: RGB = isPaid
    ? [6, 95, 70]      // emerald-800
    : isRefund
    ? [51, 65, 85]     // slate-700
    : GOLD_DEEP        // deep gold, AA on light-gold bg
  const dotRgb: RGB = isPaid
    ? [16, 185, 129]   // emerald-500
    : isRefund
    ? [148, 163, 184]  // slate-400
    : GOLD             // gold dot

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  const textW = doc.getTextWidth(label)
  const padX = 10
  const dotR = 1.8
  const dotGap = 6
  const pillW = padX + dotR * 2 + dotGap + textW + padX
  const pillH = 20
  const x = rightX - pillW
  const r = pillH / 2

  doc.setFillColor(...fill)
  doc.setDrawColor(...stroke)
  doc.setLineWidth(0.7)
  doc.roundedRect(x, y - pillH + 5, pillW, pillH, r, r, 'FD')

  // Dot
  doc.setFillColor(...dotRgb)
  doc.circle(x + padX + dotR, y - pillH / 2 + 5, dotR, 'F')

  // Label
  doc.setTextColor(...textRgb)
  doc.text(label, x + padX + dotR * 2 + dotGap, y - 1, { charSpace: 0.8 })
}

// Editorial gold rule - approximates the on-screen .invoice-rule
// gradient with three concentric segments: light edges, deep middle.
function drawGoldRule(
  doc: {
    setDrawColor: (r: number, g: number, b: number) => void
    setLineWidth: (w: number) => void
    line: (x1: number, y1: number, x2: number, y2: number) => void
  },
  x1: number,
  x2: number,
  y: number,
): void {
  const seg = (x2 - x1) / 4
  doc.setLineWidth(0.7)
  doc.setDrawColor(...GOLD)
  doc.line(x1, y, x1 + seg, y)
  doc.setDrawColor(...GOLD_DEEP)
  doc.line(x1 + seg, y, x1 + seg * 3, y)
  doc.setDrawColor(...GOLD)
  doc.line(x1 + seg * 3, y, x2, y)
}
