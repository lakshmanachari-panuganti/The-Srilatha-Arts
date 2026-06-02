'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Download, Loader2, Printer } from 'lucide-react'
import { apiFetch, ApiError } from '@/lib/api'
import { useUserAuth } from '@/stores/userAuth'
import { formatINR } from '@/lib/format'
import { STUDIO_EMAIL, PHONE_DISPLAY, WEBSITE_URL } from '@/lib/site-config'
import { downloadInvoicePdf } from '@/lib/invoice-pdf'

// Shapes mirrored from the orders.ts toApi() - kept minimal to what the
// invoice actually renders. Unknown fields ride along untouched.
interface ShippingAddress {
  fullName?: string
  phone?: string
  line1?: string
  line2?: string
  city?: string
  state?: string
  pincode?: string
  country?: string
}
interface Order {
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
  shippingAddress?: ShippingAddress
  razorpayPaymentId?: string
  createdAt: string
  updatedAt?: string
}
interface OrderItem {
  productId: string
  title: string
  category: string
  imageUrl: string
  price: number              // paise
  displayPrice: number       // rupees
  qty: number
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

// Maps payment / order status to a pill badge styling. Kept here so both
// the heading and any future inline reuses pull from one place.
type BadgeTone = 'amber' | 'emerald' | 'slate'
function statusBadge(paymentStatus: string): { label: string; tone: BadgeTone } {
  const s = (paymentStatus || '').toUpperCase()
  if (s === 'PAID') return { label: 'Paid', tone: 'emerald' }
  if (s === 'REFUNDED') return { label: 'Refunded', tone: 'slate' }
  return { label: 'Payment pending', tone: 'amber' }
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  emerald:
    'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200',
  amber:
    'bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-200',
  slate:
    'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200',
}

export default function InvoiceClient() {
  const router = useRouter()
  const user = useUserAuth((s) => s.user)

  // Same shell pattern as OrderDetailClient: read id from window.location
  // after mount. Pathname: /account/invoices/<id>/  → parts[2] = id.
  const [id, setId] = useState<string | null>(null)
  const [autoPrint, setAutoPrint] = useState(false)
  const [autoDownload, setAutoDownload] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadErr, setDownloadErr] = useState('')

  useEffect(() => {
    const parts = window.location.pathname.split('/').filter(Boolean)
    setId(parts[2] ?? null)
    const sp = new URLSearchParams(window.location.search)
    setAutoPrint(sp.get('auto') === 'print')
    setAutoDownload(sp.get('auto') === 'download')
  }, [])

  const [order, setOrder] = useState<Order | null>(null)
  const [items, setItems] = useState<OrderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState('')
  const [expired, setExpired] = useState(false)

  const refresh = useCallback(async () => {
    if (!id || id === '__shell__') return
    setLoadErr('')
    try {
      const detail = await apiFetch<{ order: Order; items: OrderItem[] }>(
        `/orders/${encodeURIComponent(id)}`,
      )
      setOrder(detail.order)
      setItems(detail.items || [])
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setExpired(true)
      } else if (e instanceof ApiError && e.status === 404) {
        setLoadErr('We could not find this order under your account.')
      } else {
        setLoadErr(e instanceof Error ? e.message : 'Could not load this order')
      }
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (id && id !== '__shell__' && !user) {
      router.replace(
        '/login?next=' +
          encodeURIComponent(`/account/invoices/${id}`),
      )
      return
    }
    refresh()
  }, [id, user, router, refresh])

  // Auto-print once data is in. Delay one tick so the layout is committed
  // (otherwise the print dialog can capture a half-rendered DOM on slow
  // mobiles). Browsers offer "Save as PDF" in the print dialog universally.
  useEffect(() => {
    if (!autoPrint || !order) return
    const t = setTimeout(() => window.print(), 350)
    return () => clearTimeout(t)
  }, [autoPrint, order])

  const handleDownload = useCallback(async () => {
    if (!order) return
    setDownloadErr('')
    setDownloading(true)
    try {
      await downloadInvoicePdf(order, items)
    } catch (e) {
      setDownloadErr(
        e instanceof Error
          ? `Could not generate the PDF: ${e.message}`
          : 'Could not generate the PDF.',
      )
    } finally {
      setDownloading(false)
    }
  }, [order, items])

  // Optional ?auto=download - used by links that want to fire the save
  // dialog as soon as the order data resolves (e.g. a future "email me
  // my invoice" flow). Triggered exactly once per page load.
  const [autoFired, setAutoFired] = useState(false)
  useEffect(() => {
    if (!autoDownload || autoFired || !order) return
    setAutoFired(true)
    handleDownload()
  }, [autoDownload, autoFired, order, handleDownload])

  if (!id || id === '__shell__' || loading) {
    return (
      <main className="max-w-3xl mx-auto px-5 py-12 lg:py-20">
        <div className="flex items-center gap-2 text-sm text-ink-mute">
          <Loader2 className="w-4 h-4 animate-spin" /> Preparing invoice…
        </div>
      </main>
    )
  }
  if (expired) {
    return (
      <main className="max-w-3xl mx-auto px-5 py-12 lg:py-20">
        <div className="card p-8 text-center">
          <h2 className="font-serif text-2xl text-ink mb-2">Your session expired</h2>
          <p className="text-sm text-ink-soft mb-5">Please sign in again to see this invoice.</p>
          <Link
            href={`/login?next=${encodeURIComponent(`/account/invoices/${id}`)}`}
            className="btn-dark"
          >
            Sign in
          </Link>
        </div>
      </main>
    )
  }
  if (loadErr || !order) {
    return (
      <main className="max-w-3xl mx-auto px-5 py-12 lg:py-20">
        <Link
          href="/account"
          className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-lavender mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to my orders
        </Link>
        <div className="card p-6 text-sm text-red-600 bg-red-50 border-red-200">
          {loadErr || 'Order not found.'}
        </div>
      </main>
    )
  }

  const addr = order.shippingAddress || {}
  const badge = statusBadge(order.paymentStatus)

  // All money on the invoice is in rupees. Backend stores paise on numeric
  // fields; displayPrice / displayTotal are pre-converted. We reconstruct
  // subtotal / shipping / discount from paise → rupees with /100, but only
  // when the field is present (older orders may not have them).
  const subtotalR =
    typeof order.subtotal === 'number' ? order.subtotal / 100 : null
  const shippingR =
    typeof order.shippingAmount === 'number' ? order.shippingAmount / 100 : null
  const discountR =
    typeof order.discountAmount === 'number' && order.discountAmount > 0
      ? order.discountAmount / 100
      : null

  return (
    <main className="max-w-3xl mx-auto px-5 py-8 lg:py-12 invoice-root">
      {/* On-screen action bar - hidden when printing */}
      <div className="flex items-center justify-between gap-3 mb-6 invoice-actions flex-wrap">
        <Link
          href={`/account/orders/${order.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-lavender transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to order
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="text-sm h-10 px-4 rounded-full border border-ink/15 text-ink hover:bg-cream-deep inline-flex items-center gap-2"
          >
            <Printer className="w-4 h-4" aria-hidden />
            Print
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="btn-dark text-sm h-10 px-4 disabled:opacity-60"
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
            ) : (
              <Download className="w-4 h-4" aria-hidden />
            )}
            {downloading ? 'Preparing PDF…' : 'Download PDF'}
          </button>
        </div>
      </div>
      {downloadErr && (
        <div className="invoice-actions mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {downloadErr}
        </div>
      )}

      {/* Invoice sheet - the only part printed.
          A thin gold hairline at the very top reads as letterhead trim
          on both screen and paper without shouting. */}
      <article className="invoice-sheet bg-white text-ink rounded-2xl border border-ink/10 shadow-sm overflow-hidden">
        <div className="invoice-trim" aria-hidden />

        <div className="p-7 sm:p-12">
          {/* ── Header ─────────────────────────────────────────────────
              Two-column letterhead. Left: brand block (logo, wordmark,
              tagline, three contact lines). Right: oversized INVOICE
              wordmark in serif, then meta + status pill. */}
          <header className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-8 sm:gap-10 pb-8">
            <div className="flex items-start gap-4 lg:gap-5">
              <div className="relative w-16 h-16 lg:w-20 lg:h-20 shrink-0">
                <Image
                  src="/Logos/logo.png"
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 80px, 64px"
                  className="object-contain"
                />
              </div>
              <div className="min-w-0">
                <p
                  className="font-serif text-2xl lg:text-[28px] text-ink leading-none tracking-[0.02em]"
                  style={{ fontVariant: 'small-caps' }}
                >
                  Srilatha Art
                </p>
                <p className="text-[11px] uppercase tracking-[0.22em] text-lavender-pastel mt-2 font-medium">
                  Handcrafted Resin · Lippan · Mandala Art
                </p>
                <div className="mt-3 space-y-0.5 text-[12px] text-ink-soft leading-relaxed">
                  <p>{WEBSITE_URL.replace(/^https?:\/\//, '')}</p>
                  <p>{STUDIO_EMAIL}</p>
                  <p className="tabular-nums">{PHONE_DISPLAY}</p>
                </div>
              </div>
            </div>

            <div className="sm:text-right">
              <p
                className="font-serif text-4xl lg:text-[56px] leading-none text-ink"
                style={{ letterSpacing: '0.08em' }}
              >
                INVOICE
              </p>
              <div className="mt-4 space-y-0.5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-ink-mute">
                  Invoice no.
                </p>
                <p className="font-serif text-lg text-ink tabular-nums">
                  {order.id}
                </p>
              </div>
              <div className="mt-3 space-y-0.5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-ink-mute">
                  Issued
                </p>
                <p className="text-sm text-ink tabular-nums">
                  {formatDate(order.createdAt)}
                </p>
              </div>
              <div className="mt-4 sm:flex sm:justify-end">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${TONE_CLASSES[badge.tone]}`}
                >
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      badge.tone === 'emerald'
                        ? 'bg-emerald-500'
                        : badge.tone === 'amber'
                        ? 'bg-amber-500'
                        : 'bg-slate-400'
                    }`}
                    aria-hidden
                  />
                  {badge.label}
                </span>
              </div>
            </div>
          </header>

          {/* Editorial gold rule - signals end of header. */}
          <div className="invoice-rule" aria-hidden />

          {/* ── Parties ────────────────────────────────────────────────
              Billed to / Ship to. Slightly more vertical air than before;
              labels are tracked-out small caps, names sit at body weight. */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-12 py-8">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-ink-mute mb-3 font-semibold">
                Billed to
              </p>
              <p className="text-[15px] font-medium text-ink">
                {order.customerName}
              </p>
              {order.customerEmail && (
                <p className="text-sm text-ink-soft mt-1">
                  {order.customerEmail}
                </p>
              )}
              {order.customerPhone && (
                <p className="text-sm text-ink-soft mt-0.5 tabular-nums">
                  {order.customerPhone}
                </p>
              )}
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-ink-mute mb-3 font-semibold">
                Ship to
              </p>
              <p className="text-[15px] font-medium text-ink">
                {addr.fullName || order.customerName}
              </p>
              <p className="text-sm text-ink-soft leading-relaxed mt-1">
                {addr.line1}
                {addr.line2 ? <>, {addr.line2}</> : null}
                {addr.line1 && <br />}
                {[addr.city, addr.state].filter(Boolean).join(', ')}
                {addr.pincode ? ` ${addr.pincode}` : ''}
                {addr.country ? <><br />{addr.country}</> : null}
              </p>
              {addr.phone && (
                <p className="text-sm text-ink-soft mt-1 tabular-nums">
                  {addr.phone}
                </p>
              )}
            </div>
          </section>

          {/* ── Items table ────────────────────────────────────────────
              Adds a 44px product thumbnail in the first cell (when an
              imageUrl is available) so each row reads like a line in a
              boutique receipt rather than a spreadsheet. Hairline divider
              between rows; comfortable 14px vertical padding. */}
          <section className="border-t border-ink/10 pt-3">
            <div className="grid grid-cols-[1fr_3rem_5rem_5.5rem] gap-3 py-3 text-[10px] uppercase tracking-[0.22em] text-ink-mute font-semibold">
              <div>Item</div>
              <div className="text-right">Qty</div>
              <div className="text-right">Unit</div>
              <div className="text-right">Amount</div>
            </div>

            {items.length === 0 ? (
              <div className="py-6 text-sm text-ink-mute border-t border-ink/8">
                No items recorded on this order.
              </div>
            ) : (
              <ul className="divide-y divide-ink/8 border-t border-ink/8">
                {items.map((it) => (
                  <li
                    key={it.productId}
                    className="grid grid-cols-[1fr_3rem_5rem_5.5rem] gap-3 py-4 items-center"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {it.imageUrl ? (
                        <div className="relative w-11 h-11 shrink-0 rounded-md overflow-hidden bg-cream-deep ring-1 ring-ink/8">
                          {/* unoptimized: invoice thumbnails come from the
                              order snapshot URL which may not be in the
                              Next image allowlist; the small size makes
                              optimization moot anyway. */}
                          <Image
                            src={it.imageUrl}
                            alt=""
                            fill
                            sizes="44px"
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <div
                          className="w-11 h-11 shrink-0 rounded-md bg-cream-deep ring-1 ring-ink/8"
                          aria-hidden
                        />
                      )}
                      <div className="min-w-0">
                        <p className="text-[14px] text-ink leading-snug truncate">
                          {it.title}
                        </p>
                        {it.category && (
                          <p className="text-[10px] text-ink-mute uppercase tracking-[0.18em] mt-1">
                            {it.category}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right tabular-nums text-[14px] text-ink-soft">
                      {it.qty}
                    </div>
                    <div className="text-right tabular-nums text-[14px] text-ink-soft">
                      {formatINR(it.displayPrice)}
                    </div>
                    <div className="text-right tabular-nums text-[14px] text-ink font-medium">
                      {formatINR(it.displayPrice * it.qty)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ── Totals ─────────────────────────────────────────────────
              Dominant Total - serif, 30px, with a hairline above and a
              gold underline below. Subtotal / Shipping sit quiet above. */}
          <section className="pt-6 pb-2 flex justify-end">
            <dl className="w-full sm:w-80 text-sm">
              <div className="space-y-2">
                {subtotalR != null && (
                  <Row label="Subtotal" value={formatINR(subtotalR)} />
                )}
                {shippingR != null && (
                  <Row
                    label="Shipping"
                    value={shippingR > 0 ? formatINR(shippingR) : 'Free'}
                  />
                )}
                {discountR != null && (
                  <Row
                    label={`Discount${order.couponCode ? ` (${order.couponCode})` : ''}`}
                    value={`− ${formatINR(discountR)}`}
                    tone="emerald"
                  />
                )}
              </div>
              <div className="mt-4 pt-4 border-t border-ink/15 flex items-baseline justify-between">
                <dt className="text-[11px] uppercase tracking-[0.22em] text-ink font-semibold">
                  Total
                </dt>
                <dd className="font-serif text-3xl text-ink tabular-nums leading-none">
                  {formatINR(order.displayTotal)}
                </dd>
              </div>
              <div className="invoice-total-underline mt-2 ml-auto" aria-hidden />
              <p className="text-[11px] text-ink-mute pt-3 text-right">
                Inclusive of all taxes.
              </p>
            </dl>
          </section>

          {/* ── Footer ─────────────────────────────────────────────────
              Replaces the generic receipt footer with a studio-letter
              thank-you. Payment reference (when present) sits above as
              the only piece of operational metadata. */}
          <footer className="mt-8 pt-8 border-t border-ink/10">
            {order.razorpayPaymentId && (
              <p className="text-[11px] text-ink-mute mb-6">
                Payment reference:{' '}
                <span className="tabular-nums text-ink-soft">
                  {order.razorpayPaymentId}
                </span>
              </p>
            )}
            <p
              className="font-serif text-lg text-ink leading-snug"
              style={{ letterSpacing: '0.01em' }}
            >
              Thank you for supporting handcrafted art.
            </p>
            <p className="text-sm text-ink-soft leading-relaxed mt-2 max-w-md">
              Every piece from Srilatha Art is individually designed and
              handmade in our Hyderabad studio.
            </p>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-x-8 gap-y-1 text-[12px]">
              <p className="uppercase tracking-[0.22em] text-ink-mute font-semibold">
                Questions?
              </p>
              <div className="text-ink-soft space-y-0.5">
                <p>{STUDIO_EMAIL}</p>
                <p className="tabular-nums">{PHONE_DISPLAY}</p>
                <p>{WEBSITE_URL.replace(/^https?:\/\//, '')}</p>
              </div>
            </div>

            <p className="text-[10px] uppercase tracking-[0.2em] text-ink-mute mt-8">
              This invoice is generated electronically and is valid without
              signature.
            </p>
          </footer>
        </div>
      </article>

      {/* Print + sheet styles - scoped global so the styled-jsx <style>
          tag picks up the rule against deep child selectors. */}
      <style jsx global>{`
        .invoice-sheet {
          /* Subtle vertical paper tone - reads as letterhead under print
             without affecting on-screen perception of "white". */
          background:
            linear-gradient(180deg, #ffffff 0%, #fdfcf8 100%);
        }
        .invoice-trim {
          height: 4px;
          background: linear-gradient(
            90deg,
            #8a6a1a 0%,
            #c8962f 35%,
            #e8c25a 50%,
            #c8962f 65%,
            #8a6a1a 100%
          );
        }
        .invoice-rule {
          height: 1px;
          background: linear-gradient(
            to right,
            transparent 0%,
            rgba(200, 150, 47, 0.55) 18%,
            rgba(138, 106, 26, 0.65) 50%,
            rgba(200, 150, 47, 0.55) 82%,
            transparent 100%
          );
        }
        .invoice-total-underline {
          width: 64px;
          height: 2px;
          background: linear-gradient(
            90deg,
            #c8962f 0%,
            #8a6a1a 100%
          );
          border-radius: 2px;
        }

        @media print {
          @page { margin: 14mm; }
          html, body { background: #fff !important; }
          .invoice-actions { display: none !important; }
          .invoice-root { padding: 0 !important; max-width: none !important; }
          .invoice-sheet {
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            background: #fff !important;
          }
          .invoice-sheet > div {
            padding: 0 !important;
          }
          .invoice-trim {
            /* Keep the gold trim in print - colour-adjust hint helps
               Chromium honour it instead of stripping background prints. */
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          /* Hide site chrome (header, bottom tab bar, FAB) when printing. */
          header.fixed, nav[aria-label="Primary"], a[aria-label*="WhatsApp"] {
            display: none !important;
          }
          main { padding-top: 0 !important; }
        }
      `}</style>
    </main>
  )
}

function Row({
  label, value, tone,
}: {
  label: string
  value: string
  tone?: 'emerald'
}) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-ink-soft">{label}</dt>
      <dd
        className={`tabular-nums ${
          tone === 'emerald' ? 'text-emerald-700' : 'text-ink'
        }`}
      >
        {value}
      </dd>
    </div>
  )
}
