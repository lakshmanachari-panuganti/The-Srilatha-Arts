/**
 * Server-side invoice PDF builder.
 *
 * Mirrors the layout of frontend/lib/invoice-pdf.ts so the PDF attached
 * to the WhatsApp confirmation reads as the same artefact the customer
 * sees if they hit "Download" inside their account. We deliberately keep
 * the two implementations visually aligned rather than sharing a module
 * because the browser version uses HTMLImageElement / canvas (DOM-only)
 * and this one uses sharp / fetch (Node-only).
 *
 * Returns a Buffer with the rendered PDF bytes - the caller decides
 * where to put them (blob upload, attachment, HTTP response, etc.).
 */

import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import sharp from 'sharp'
import { CONTACT } from '../config/contact'

// ─── Brand palette (mirrors frontend/app/globals.css :root) ────────
type RGB = [number, number, number]
const INK: RGB = [34, 27, 18]
const INK_SOFT: RGB = [67, 57, 46]
const INK_MUTE: RGB = [138, 126, 110]
const RULE: RGB = [225, 219, 207]
const GOLD: RGB = [184, 138, 45]
const GOLD_DEEP: RGB = [138, 106, 26]
const PAPER: RGB = [253, 252, 248]

// Brand contact lines come from the shared backend constant, which
// mirrors frontend/lib/site-config.ts (see backend/src/config/contact.ts).
const STUDIO_EMAIL = CONTACT.email
const PHONE_DISPLAY = CONTACT.phoneDisplay
const WEBSITE_HOST = CONTACT.websiteHost

export interface InvoiceItem {
  productId: string
  title: string
  category: string
  imageUrl?: string
  displayPrice: number
  qty: number
}

export interface InvoiceOrder {
  id: string
  status: string
  paymentStatus: string
  displayTotal: number
  subtotal?: number          // paise
  shippingAmount?: number    // paise
  discountAmount?: number    // paise
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

interface LoadedImage {
  base64: string
  format: 'PNG' | 'JPEG'
  w: number
  h: number
}

function fmtDate(iso: string): string {
  // IST formatting to match the studio timezone used by the order
  // number. Falls back to ISO if the input is bad.
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

// Helvetica has no glyph for ₹ - swap to "Rs." so it renders on every
// PDF reader. Same compromise as the frontend builder.
function fmtMoney(rs: number): string {
  return `Rs. ${rs.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

// Fetch an image and downscale with sharp so the PDF embeds a small
// artefact (≤ maxDim px on the long edge) instead of the original
// product photo. Returns null on any failure so the layout can fall
// back to a placeholder block.
async function loadImage(
  url: string | undefined,
  opts: { maxDim: number; format: 'PNG' | 'JPEG' },
): Promise<LoadedImage | null> {
  if (!url) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    let pipeline = sharp(buf).resize(opts.maxDim, opts.maxDim, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    if (opts.format === 'JPEG') {
      // Flatten alpha against white so transparent PNG thumbnails don't
      // render black on the ivory paper background.
      pipeline = pipeline.flatten({ background: '#ffffff' }).jpeg({ quality: 82 })
    } else {
      pipeline = pipeline.png({ compressionLevel: 9 })
    }
    const out = await pipeline.toBuffer({ resolveWithObject: true })
    return {
      base64: out.data.toString('base64'),
      format: opts.format,
      w: out.info.width,
      h: out.info.height,
    }
  } catch {
    return null
  }
}

/**
 * Build the invoice PDF and return its bytes.
 */
export async function buildInvoicePdf(
  order: InvoiceOrder,
  items: InvoiceItem[],
): Promise<Buffer> {
  // Logo is optional - server PDFs are emitted from environments that
  // may not have the file. INVOICE_LOGO_URL can point at a blob copy of
  // the logo for branded letterhead; without it the wordmark stands on
  // its own.
  const logoUrl = process.env.INVOICE_LOGO_URL
  const [logo, thumbs] = await Promise.all([
    loadImage(logoUrl, { maxDim: 240, format: 'PNG' }),
    Promise.all(
      items.map((it) =>
        loadImage(it.imageUrl, { maxDim: 160, format: 'JPEG' }),
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

  doc.setFillColor(...PAPER)
  doc.rect(0, 4, pageW, pageH - 4, 'F')

  let y = margin + 4

  // ── Header: brand block (left) vs. invoice meta (right) ──────────
  const logoSize = 62
  const brandTextX = logo ? margin + logoSize + 16 : margin
  if (logo) {
    doc.addImage(
      `data:image/png;base64,${logo.base64}`,
      'PNG',
      margin,
      y - 2,
      logoSize,
      logoSize,
      undefined,
      'FAST',
    )
  }

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...INK)
  doc.setFontSize(22)
  doc.text('Srilatha Art', brandTextX, y + 18, { charSpace: 0.6 })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...INK_SOFT)
  doc.text(WEBSITE_HOST, brandTextX, y + 34)
  doc.text(STUDIO_EMAIL, brandTextX, y + 46)
  doc.text(PHONE_DISPLAY, brandTextX, y + 58)

  // ── Right column: oversized INVOICE wordmark + meta + status pill ─
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(34)
  doc.setTextColor(...INK)
  doc.text('RECEIPT', pageW - margin, y + 18, {
    align: 'right',
    charSpace: 2.6,
  })

  doc.setDrawColor(...GOLD)
  doc.setLineWidth(1.6)
  doc.line(pageW - margin - 56, y + 26, pageW - margin, y + 26)

  const metaLabelY = y + 42
  const metaIssuedY = y + 56

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...INK)
  const idText = order.id
  doc.text(idText, pageW - margin, metaLabelY, { align: 'right' })
  const idW = doc.getTextWidth(idText)
  doc.setTextColor(...INK_MUTE)
  doc.text('Receipt No:', pageW - margin - idW - 4, metaLabelY, { align: 'right' })

  doc.setTextColor(...INK)
  const dateText = fmtDate(order.createdAt)
  doc.text(dateText, pageW - margin, metaIssuedY, { align: 'right' })
  const dateW = doc.getTextWidth(dateText)
  doc.setTextColor(...INK_MUTE)
  doc.text('Issued:', pageW - margin - dateW - 4, metaIssuedY, { align: 'right' })

  drawStatusPill(doc, order.paymentStatus, pageW - margin, y + 78)

  y += 96

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
  const THUMB_PX = 38
  const THUMB_GAP = 10
  const THUMB_PAD_LEFT = 4
  const FIRST_COL_LEFT_PAD = THUMB_PAD_LEFT + THUMB_PX + THUMB_GAP

  const rows = items.length === 0
    ? [['No items recorded on this order.', '', '', '']]
    : items.map((it) => [
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
      textColor: [...INK] as [number, number, number],
      cellPadding: { top: 12, bottom: 12, left: 0, right: 8 },
      lineColor: [...RULE] as [number, number, number],
      lineWidth: 0,
      valign: 'middle',
      minCellHeight: THUMB_PX + 12,
    },
    headStyles: {
      fontSize: 7.5,
      textColor: [...INK_MUTE] as [number, number, number],
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
    didDrawCell: (data) => {
      if (data.section === 'head' && data.column.index === 0) {
        const { y: cy } = data.cell
        doc.setDrawColor(...INK)
        doc.setLineWidth(0.6)
        doc.line(margin, cy, pageW - margin, cy)
      }
      if (data.section === 'body' && data.column.index === 0) {
        const { x: cx, y: cy, height } = data.cell
        doc.setDrawColor(...RULE)
        doc.setLineWidth(0.4)
        doc.line(margin, cy + height, pageW - margin, cy + height)

        const thumb = thumbs[data.row.index]
        const tx = cx + THUMB_PAD_LEFT
        const ty = cy + (height - THUMB_PX) / 2
        if (thumb) {
          doc.addImage(
            `data:image/jpeg;base64,${thumb.base64}`,
            thumb.format,
            tx,
            ty,
            THUMB_PX,
            THUMB_PX,
            undefined,
            'FAST',
          )
          doc.setDrawColor(...RULE)
          doc.setLineWidth(0.4)
          doc.rect(tx, ty, THUMB_PX, THUMB_PX, 'S')
        } else if (items.length > 0) {
          doc.setFillColor(...PAPER)
          doc.setDrawColor(...RULE)
          doc.setLineWidth(0.4)
          doc.rect(tx, ty, THUMB_PX, THUMB_PX, 'FD')
        }
      }
    },
  })

  type AutoTableDoc = jsPDF & { lastAutoTable?: { finalY: number } }
  y = ((doc as AutoTableDoc).lastAutoTable?.finalY ?? y) + 26

  // ── Totals + Footer height check ──────────────────────────────
  const totalsBlockH = estimateTotalsAndFooterHeight(order)
  if (y + totalsBlockH > pageH - margin) {
    doc.addPage()
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
    totalLines.push({ label: 'Subtotal', value: fmtMoney(order.subtotal / 100) })
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

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  totalLines.forEach((row) => {
    doc.setTextColor(...INK_SOFT)
    doc.text(row.label, totalsX, y)
    doc.setTextColor(...INK)
    doc.text(row.value, valX, y, { align: 'right' })
    y += lineH
  })

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

  // ── Footer ─────────────────────────────────────────────────────
  doc.setDrawColor(...RULE)
  doc.setLineWidth(0.5)
  doc.line(margin, y, pageW - margin, y)
  y += 24

  if (order.razorpayPaymentId) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...INK_MUTE)
    doc.text(`Payment reference: ${order.razorpayPaymentId}`, margin, y)
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
    `Every piece from Srilatha Art is individually designed and handmade in our studio at ${CONTACT.studioAddress.line1}, ${CONTACT.studioAddress.line2}, ${CONTACT.studioAddress.city}.`
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
  doc.text(WEBSITE_HOST, margin + 88, y + 28)
  y += 48

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...INK_MUTE)
  doc.text(
    'This receipt is generated electronically and is valid without signature.',
    margin,
    y,
    { charSpace: 0.6 },
  )

  const ab = doc.output('arraybuffer')
  return Buffer.from(ab)
}

function estimateTotalsAndFooterHeight(order: InvoiceOrder): number {
  let h = 0
  if (typeof order.subtotal === 'number') h += 17
  if (typeof order.shippingAmount === 'number') h += 17
  if (typeof order.discountAmount === 'number' && order.discountAmount > 0) h += 17
  h += 6 + 24 + 24 + 38
  h += 24
  if (order.razorpayPaymentId) h += 18
  h += 17 + 14 * 2 + 14 + 48 + 18
  return h
}

function drawStatusPill(
  doc: jsPDF,
  paymentStatus: string,
  rightX: number,
  y: number,
): void {
  const s = (paymentStatus || '').toUpperCase()
  // The wire status is CAPTURED for paid orders - normalise to PAID
  // for the human-readable pill, matching the on-screen invoice.
  const isPaid = s === 'PAID' || s === 'CAPTURED'
  const isRefund = s === 'REFUNDED'
  const label = isPaid ? 'PAID' : isRefund ? 'REFUNDED' : 'PAYMENT PENDING'

  const fill: RGB = isPaid ? [236, 253, 245] : isRefund ? [241, 245, 249] : [255, 247, 224]
  const stroke: RGB = isPaid ? [167, 243, 208] : isRefund ? [203, 213, 225] : [232, 194, 90]
  const textRgb: RGB = isPaid ? [6, 95, 70] : isRefund ? [51, 65, 85] : GOLD_DEEP
  const dotRgb: RGB = isPaid ? [16, 185, 129] : isRefund ? [148, 163, 184] : GOLD

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

  doc.setFillColor(...dotRgb)
  doc.circle(x + padX + dotR, y - pillH / 2 + 5, dotR, 'F')

  doc.setTextColor(...textRgb)
  doc.text(label, x + padX + dotR * 2 + dotGap, y - 1, { charSpace: 0.8 })
}

function drawGoldRule(doc: jsPDF, x1: number, x2: number, y: number): void {
  const seg = (x2 - x1) / 4
  doc.setLineWidth(0.7)
  doc.setDrawColor(...GOLD)
  doc.line(x1, y, x1 + seg, y)
  doc.setDrawColor(...GOLD_DEEP)
  doc.line(x1 + seg, y, x1 + seg * 3, y)
  doc.setDrawColor(...GOLD)
  doc.line(x1 + seg * 3, y, x2, y)
}
