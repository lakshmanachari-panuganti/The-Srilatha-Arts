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

// Shapes mirrored from the orders.ts toApi() — kept minimal to what the
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
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export default function InvoiceClient() {
  const router = useRouter()
  const user = useUserAuth((s) => s.user)

  // Same shell pattern as OrderDetailClient: read id from window.location
  // after mount. Pathname: /account/orders/<id>/invoice/  → parts[2] = id.
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
          encodeURIComponent(`/account/orders/${id}/invoice`),
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

  // Optional ?auto=download — used by links that want to fire the save
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
            href={`/login?next=${encodeURIComponent(`/account/orders/${id}/invoice`)}`}
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
      {/* On-screen action bar — hidden when printing */}
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

      {/* Invoice sheet — the only part printed */}
      <article className="invoice-sheet bg-white text-ink rounded-2xl border border-ink/10 shadow-sm p-6 sm:p-10">
        {/* Header: studio brand block + invoice meta */}
        <header className="flex items-start justify-between gap-6 pb-6 border-b border-ink/10">
          <div className="flex items-center gap-3">
            <div className="relative w-14 h-14 shrink-0">
              <Image
                src="/Logos/logo.png"
                alt=""
                fill
                sizes="56px"
                className="object-contain"
              />
            </div>
            <div>
              <p className="font-serif text-2xl text-ink leading-none">Srilatha Art</p>
              <p className="text-xs text-ink-mute mt-1">{WEBSITE_URL.replace(/^https?:\/\//, '')}</p>
              <p className="text-xs text-ink-mute">
                {STUDIO_EMAIL} · {PHONE_DISPLAY}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-[0.18em] text-ink-mute">Invoice</p>
            <p className="font-serif text-xl text-ink tabular-nums">{order.id}</p>
            <p className="text-xs text-ink-mute mt-1">Dated {formatDate(order.createdAt)}</p>
            <p className="text-[11px] uppercase tracking-[0.15em] mt-2">
              <span
                className={
                  order.paymentStatus === 'PAID'
                    ? 'text-emerald-700'
                    : 'text-amber-700'
                }
              >
                {order.paymentStatus === 'PAID' ? 'Paid' : 'Payment pending'}
              </span>
            </p>
          </div>
        </header>

        {/* Billing / shipping block */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-b border-ink/10">
          <div>
            <p className="text-[11px] uppercase tracking-[0.15em] text-ink-mute mb-2">Billed to</p>
            <p className="text-sm font-medium text-ink">{order.customerName}</p>
            {order.customerEmail && (
              <p className="text-sm text-ink-soft">{order.customerEmail}</p>
            )}
            {order.customerPhone && (
              <p className="text-sm text-ink-soft">{order.customerPhone}</p>
            )}
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.15em] text-ink-mute mb-2">Ship to</p>
            <p className="text-sm text-ink">
              {addr.fullName || order.customerName}
            </p>
            <p className="text-sm text-ink-soft leading-relaxed">
              {addr.line1}
              {addr.line2 ? <>, {addr.line2}</> : null}
              {addr.line1 && <br />}
              {[addr.city, addr.state].filter(Boolean).join(', ')}
              {addr.pincode ? ` ${addr.pincode}` : ''}
              {addr.country ? <><br />{addr.country}</> : null}
            </p>
            {addr.phone && (
              <p className="text-sm text-ink-soft mt-1">{addr.phone}</p>
            )}
          </div>
        </section>

        {/* Items table */}
        <section className="py-6 border-b border-ink/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.15em] text-ink-mute">
                <th className="text-left font-medium pb-2">Item</th>
                <th className="text-right font-medium pb-2 w-16">Qty</th>
                <th className="text-right font-medium pb-2 w-24">Unit</th>
                <th className="text-right font-medium pb-2 w-28">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/8">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-3 text-ink-mute">
                    No items recorded on this order.
                  </td>
                </tr>
              ) : (
                items.map((it) => (
                  <tr key={it.productId} className="align-top">
                    <td className="py-3">
                      <p className="text-ink">{it.title}</p>
                      <p className="text-[11px] text-ink-mute uppercase tracking-wider">
                        {it.category}
                      </p>
                    </td>
                    <td className="py-3 text-right tabular-nums">{it.qty}</td>
                    <td className="py-3 text-right tabular-nums">
                      {formatINR(it.displayPrice)}
                    </td>
                    <td className="py-3 text-right tabular-nums">
                      {formatINR(it.displayPrice * it.qty)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        {/* Totals */}
        <section className="py-6 flex justify-end">
          <dl className="w-full sm:w-72 text-sm space-y-1.5">
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
            <div className="pt-2 mt-2 border-t border-ink/15 flex items-baseline justify-between">
              <dt className="text-sm font-medium text-ink">Total</dt>
              <dd className="font-serif text-xl font-semibold text-ink tabular-nums">
                {formatINR(order.displayTotal)}
              </dd>
            </div>
            <p className="text-[11px] text-ink-mute pt-1">Inclusive of all taxes.</p>
          </dl>
        </section>

        {/* Payment reference + footer */}
        <footer className="pt-6 border-t border-ink/10 text-[11px] text-ink-mute leading-relaxed">
          {order.razorpayPaymentId && (
            <p className="mb-2">
              Payment reference:{' '}
              <span className="tabular-nums text-ink">{order.razorpayPaymentId}</span>
            </p>
          )}
          <p>
            Thank you for supporting handmade work. Questions about this invoice?
            Email {STUDIO_EMAIL} or call {PHONE_DISPLAY}.
          </p>
          <p className="mt-1">
            This invoice is generated electronically and is valid without signature.
          </p>
        </footer>
      </article>

      {/* Print styles — keep them scoped to this page so other routes are
          unaffected. The action bar hides; the sheet flattens to plain paper. */}
      <style jsx global>{`
        @media print {
          @page { margin: 16mm; }
          html, body { background: #fff !important; }
          .invoice-actions { display: none !important; }
          .invoice-root { padding: 0 !important; max-width: none !important; }
          .invoice-sheet {
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
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
