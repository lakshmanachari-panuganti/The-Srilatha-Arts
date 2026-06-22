'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Package, Mail, MapPin, MessageSquare, Send, Loader2, AlertCircle,
  Phone, RotateCcw, CheckCircle2, XCircle, IndianRupee,
} from 'lucide-react'
import { formatINR, formatDate } from '@/lib/format'
import { apiFetch } from '@/lib/api'

// ─── Domain types - mirror what the backend toApi() returns ──────────────

type OrderStatus =
  | 'PLACED' | 'CONFIRMED' | 'CRAFTING' | 'PACKED' | 'SHIPPED' | 'OUT_FOR_DELIVERY'
  | 'DELIVERED' | 'CANCELLED' | 'ON_HOLD'
  | 'RETURN_REQUESTED' | 'RETURNED' | 'REFUNDED'

interface AdminOrderItem {
  productId: string
  title: string
  category: string
  imageUrl?: string
  price: number          // paise
  displayPrice: number   // rupees
  qty: number
}

interface AdminOrderEvent {
  id: string
  fromStatus?: string
  toStatus?: string
  channel: string
  by: string
  byRole: string
  note?: string
  meta?: unknown
  createdAt: string
}

interface AdminOrder {
  id: string
  status: OrderStatus
  paymentStatus: string
  items?: unknown                       // serialised in some rows
  totalAmount: number                   // paise
  displayTotal: number                  // rupees
  subtotal: number                      // paise
  shippingAmount: number                // paise
  discountAmount?: number
  couponCode?: string
  customerName: string
  customerEmail?: string
  customerPhone?: string
  shippingAddress?: {
    line1?: string
    line2?: string
    city?: string
    state?: string
    pincode?: string
    fullName?: string
    phone?: string
  }
  trackingNumber?: string
  courier?: string
  courierUrl?: string
  cancelReason?: string
  holdReason?: string
  razorpayOrderId?: string
  razorpayPaymentId?: string
  razorpayRefundId?: string
  customerNote?: string
  // Return / refund metadata
  returnRequestedAt?: string
  returnReason?: string
  returnComment?: string
  returnPhotos?: string[]
  returnDeclineReason?: string
  refundedAt?: string
  refundAmount?: number               // paise
  refundFailureReason?: string
  invoiceUrl?: string                 // branded blob URL once payment captured
  emailStatus?: 'pending' | 'sent' | 'failed'
  emailSentAt?: string
  emailAttempts?: number
  emailLastError?: string
  whatsappStatus?: 'pending' | 'sent' | 'failed'
  whatsappSentAt?: string
  whatsappLastError?: string
  createdAt: string
  updatedAt: string
}

interface OrderDetailResponse {
  order: AdminOrder
  items: AdminOrderItem[]
  events: AdminOrderEvent[]
  nextStates: { status: OrderStatus; label: string }[]
}

// ─── Visual tokens ───────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  PLACED:           'bg-blue-50 text-blue-700 ring-blue-600/20',
  CONFIRMED:        'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  CRAFTING:         'bg-purple-50 text-purple-700 ring-purple-600/20',
  PACKED:           'bg-yellow-50 text-yellow-800 ring-yellow-600/20',
  SHIPPED:          'bg-orange-50 text-orange-700 ring-orange-600/20',
  OUT_FOR_DELIVERY: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  DELIVERED:        'bg-green-50 text-green-700 ring-green-600/20',
  CANCELLED:        'bg-red-50 text-red-700 ring-red-600/10',
  ON_HOLD:          'bg-gray-50 text-gray-700 ring-gray-600/20',
  RETURN_REQUESTED: 'bg-pink-50 text-pink-700 ring-pink-600/20',
  RETURNED:         'bg-rose-50 text-rose-700 ring-rose-600/20',
  REFUNDED:         'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
}

const RETURN_REASON_LABEL: Record<string, string> = {
  damaged:          'Item arrived damaged',
  wrong_item:       'Wrong item delivered',
  not_as_described: 'Item is not as described',
  size_issue:       'Size or fit issue',
  quality_issue:    'Quality is not what they expected',
  changed_mind:     'Changed their mind',
  other:            'Other reason',
}

// ─── Page entry ──────────────────────────────────────────────────────────

function OrderDetail() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id')

  const [data, setData] = useState<OrderDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState('')
  const [actionErr, setActionErr] = useState('')
  const [note, setNote] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | ''>('')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    if (!id) return
    setLoadErr('')
    try {
      const r = await apiFetch<OrderDetailResponse>(`/admin/orders/${encodeURIComponent(id)}`)
      setData(r)
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'Could not load this order')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { refresh() }, [refresh])

  if (!id) {
    return (
      <ErrorPanel msg="Missing order id in the URL - make sure you opened this page via the Orders list." />
    )
  }
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-ink-mute">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading order…
      </div>
    )
  }
  if (loadErr || !data) {
    return <ErrorPanel msg={loadErr || 'Order not found.'} />
  }

  const { order, items, events, nextStates } = data

  async function updateStatus(extras: Record<string, unknown> = {}) {
    if (!selectedStatus) { setActionErr('Pick a target status first.'); return }
    setActionErr(''); setBusy(true)
    try {
      await apiFetch(`/admin/orders/${encodeURIComponent(id!)}/status`, {
        method: 'PATCH',
        body: { to: selectedStatus, note: note.trim() || undefined, ...extras },
      })
      setNote('')
      setSelectedStatus('')
      await refresh()
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : 'Could not update status')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      {/* Back + Header - order #, customer, and status all read as one unit */}
      <div className="mb-6">
        <Link href="/admin/orders" className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink mb-3 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Orders
        </Link>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="font-serif text-2xl md:text-3xl text-ink tabular-nums leading-tight">
            #{order.id}
          </h1>
          <span className="text-ink-mute select-none" aria-hidden>·</span>
          <span className="text-base md:text-lg text-ink-soft truncate max-w-[16rem]">
            {order.customerName}
          </span>
          <span className={`ml-auto inline-flex items-center px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium ring-1 ring-inset ${STATUS_COLORS[order.status] || 'bg-gray-50 text-gray-700 ring-gray-600/20'}`}>
            {order.status.replace(/_/g, ' ')}
          </span>
        </div>
        <p className="mt-1.5 text-xs text-ink-mute">Placed {formatDate(order.createdAt)}</p>
      </div>

      {/* Return-flow banners - high signal, render at the very top of the
          main content area so admin can act without scrolling. */}
      <ReturnPanels
        order={order}
        onChanged={refresh}
        setActionErr={setActionErr}
      />

      {actionErr && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 px-3 py-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{actionErr}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Items */}
          <div className="bg-plum-light border border-ink/10 rounded-xl p-4 md:p-6">
            <h2 className="font-serif text-lg text-ink mb-4">Items</h2>
            <div className="divide-y divide-ink/5">
              {items.length === 0 && (
                <p className="text-sm text-ink-mute">No item snapshot recorded.</p>
              )}
              {items.map((item) => (
                <div key={item.productId} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="w-14 h-14 rounded-lg bg-cream-deep border border-ink/5 shrink-0 flex items-center justify-center overflow-hidden">
                    {item.imageUrl
                      ? <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                      : <Package className="w-6 h-6 text-ink-mute" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-ink text-sm truncate">{item.title}</p>
                    <p className="text-xs text-ink-mute capitalize">{item.category.replace('-', ' ')} · Qty: {item.qty}</p>
                  </div>
                  <p className="font-semibold text-ink text-sm shrink-0 tabular-nums">{formatINR(item.displayPrice)}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-ink/10 mt-4 pt-4 space-y-1.5 text-sm tabular-nums">
              <div className="flex justify-between text-ink-soft"><span>Subtotal</span><span>{formatINR(order.subtotal / 100)}</span></div>
              <div className="flex justify-between text-ink-soft"><span>Shipping</span><span>{order.shippingAmount === 0 ? 'FREE' : formatINR(order.shippingAmount / 100)}</span></div>
              {(order.discountAmount ?? 0) > 0 && (
                <div className="flex justify-between text-green-700"><span>Discount{order.couponCode ? ` (${order.couponCode})` : ''}</span><span>−{formatINR((order.discountAmount ?? 0) / 100)}</span></div>
              )}
              <div className="flex justify-between font-semibold text-ink text-base pt-1 border-t border-ink/5"><span>Total</span><span>{formatINR(order.displayTotal)}</span></div>
              {order.refundedAt && order.refundAmount != null && (
                <div className="flex justify-between text-emerald-700 pt-1"><span>Refunded</span><span>−{formatINR(order.refundAmount / 100)}</span></div>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-plum-light border border-ink/10 rounded-xl p-4 md:p-6">
            <h2 className="font-serif text-lg text-ink mb-4">Activity timeline</h2>
            {events.length === 0 ? (
              <p className="text-sm text-ink-mute">No events recorded yet.</p>
            ) : (
              <div className="space-y-0">
                {events.map((event, i) => (
                  <div key={event.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full shrink-0 mt-1.5 ${i === events.length - 1 ? 'bg-lavender ring-4 ring-lavender/20' : 'bg-green-500'}`} />
                      {i < events.length - 1 && <div className="w-px flex-1 bg-ink/10 my-1" />}
                    </div>
                    <div className="pb-4">
                      <p className="text-sm font-medium text-ink">
                        {event.toStatus ? event.toStatus.replace(/_/g, ' ') : event.channel}
                      </p>
                      {event.note && <p className="text-xs text-ink-mute">{event.note}</p>}
                      <p className="text-xs text-ink-mute mt-0.5">
                        {new Date(event.createdAt).toLocaleString('en-IN')} · {event.by} ({event.byRole})
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* Add an internal note without changing status. Hits the
                dedicated POST /api/admin/orders/{id}/notes endpoint
                (separate from the status-PATCH note, which couples the
                note to a state transition). */}
            <AddInternalNote orderId={order.id} onAdded={refresh} />
          </div>

          {/* Status update (only when there are valid next states) */}
          {nextStates.length > 0 && (
            <div className="bg-plum-light border border-ink/10 rounded-xl p-4 md:p-6">
              <h2 className="font-serif text-lg text-ink mb-4">Update status</h2>
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value as OrderStatus)}
                  className="flex-1 h-11 px-4 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender"
                >
                  <option value="">Select next status…</option>
                  {nextStates.map((s) => (
                    <option key={s.status} value={s.status}>{s.label}</option>
                  ))}
                </select>
                <button
                  onClick={() => updateStatus()}
                  disabled={!selectedStatus || busy}
                  className="btn-dark text-sm h-11 px-6 shrink-0 disabled:opacity-60"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Update
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1.5">Internal note (optional)</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Notes are written to the order timeline."
                  className="w-full px-4 py-3 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer */}
          <div className="bg-plum-light border border-ink/10 rounded-xl p-4 md:p-6">
            <h2 className="font-serif text-lg text-ink mb-3">Customer</h2>
            <p className="font-medium text-ink mb-2">{order.customerName}</p>
            <div className="space-y-2 text-sm text-ink-soft">
              {order.customerEmail && <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" />{order.customerEmail}</div>}
              {order.customerPhone && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" />{order.customerPhone}</div>}
            </div>
          </div>

          {/* Shipping */}
          {order.shippingAddress && (
            <div className="bg-plum-light border border-ink/10 rounded-xl p-4 md:p-6">
              <h2 className="font-serif text-lg text-ink mb-3">Shipping address</h2>
              <div className="flex items-start gap-2 text-sm text-ink-soft">
                <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <div>
                  {order.shippingAddress.fullName && <p className="text-ink">{order.shippingAddress.fullName}</p>}
                  {order.shippingAddress.line1 && <p>{order.shippingAddress.line1}</p>}
                  {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
                  <p>
                    {[order.shippingAddress.city, order.shippingAddress.state, order.shippingAddress.pincode]
                      .filter(Boolean).join(', ')}
                  </p>
                  {order.shippingAddress.phone && <p className="text-ink-mute mt-1">{order.shippingAddress.phone}</p>}
                </div>
              </div>
            </div>
          )}

          {/* Payment */}
          <div className="bg-plum-light border border-ink/10 rounded-xl p-4 md:p-6">
            <h2 className="font-serif text-lg text-ink mb-3">Payment</h2>
            <div className="flex items-center gap-2 mb-2">
              <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ring-1 ring-inset ${
                order.paymentStatus === 'CAPTURED'
                  ? 'bg-green-50 text-green-700 ring-green-600/20'
                  : order.paymentStatus === 'REFUNDED'
                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                    : order.paymentStatus === 'FAILED'
                      ? 'bg-red-50 text-red-700 ring-red-600/20'
                      : 'bg-amber-50 text-amber-700 ring-amber-600/20'
              }`}>
                {order.paymentStatus}
              </span>
            </div>
            {order.razorpayPaymentId && (
              <p className="text-xs text-ink-mute font-mono break-all">
                Payment: {order.razorpayPaymentId}
              </p>
            )}
            {order.razorpayRefundId && (
              <p className="text-xs text-ink-mute font-mono break-all mt-1">
                Refund: {order.razorpayRefundId}
              </p>
            )}
          </div>

          {/* Invoice + notifications panel - single source of truth
              (the PDF on blob storage) for the customer's invoice. */}
          <NotificationsPanel order={order} onChanged={refresh} />

          {/* Quick contact actions */}
          {(order.customerPhone || order.customerEmail) && (
            <div className="bg-plum-light border border-ink/10 rounded-xl p-4 md:p-6">
              <h2 className="font-serif text-lg text-ink mb-3">Quick actions</h2>
              <div className="space-y-2">
                {order.customerPhone && (
                  <a
                    href={`https://wa.me/${order.customerPhone.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-ink-soft hover:text-plum hover:bg-lavender-pastel/10 rounded-lg transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" /> WhatsApp customer
                  </a>
                )}
                {order.customerEmail && (
                  <a
                    href={`mailto:${order.customerEmail}?subject=About your Srilatha Art order ${order.id}`}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-ink-soft hover:text-plum hover:bg-lavender-pastel/10 rounded-lg transition-colors"
                  >
                    <Mail className="w-4 h-4" /> Email customer
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Return-flow panels (RETURN_REQUESTED → approve / decline, RETURNED → refund) ────

function ReturnPanels({
  order,
  onChanged,
  setActionErr,
}: {
  order: AdminOrder
  onChanged: () => Promise<void> | void
  setActionErr: (s: string) => void
}) {
  const [showDecline, setShowDecline] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const [showRefund, setShowRefund] = useState(false)
  const [refundRupees, setRefundRupees] = useState<number>(order.displayTotal)
  const [busy, setBusy] = useState(false)

  // Sync the refund-modal default whenever the order changes (e.g. after a
  // refresh) so it stays in lock-step with displayTotal.
  useEffect(() => { setRefundRupees(order.displayTotal) }, [order.displayTotal])

  async function approveReturn() {
    setActionErr(''); setBusy(true)
    try {
      await apiFetch(`/admin/orders/${encodeURIComponent(order.id)}/status`, {
        method: 'PATCH',
        body: {
          to: 'RETURNED',
          note: 'Return approved. Awaiting item back from customer.',
          notifyCustomer: true,
        },
      })
      await onChanged()
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : 'Could not approve return')
    } finally {
      setBusy(false)
    }
  }

  async function declineReturn() {
    if (!declineReason.trim()) { setActionErr('Please add a reason for declining.'); return }
    setActionErr(''); setBusy(true)
    try {
      await apiFetch(`/admin/orders/${encodeURIComponent(order.id)}/return/decline`, {
        method: 'POST',
        body: { reason: declineReason.trim(), notifyCustomer: true },
      })
      setShowDecline(false)
      setDeclineReason('')
      await onChanged()
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : 'Could not decline return')
    } finally {
      setBusy(false)
    }
  }

  async function issueRefund() {
    if (!Number.isFinite(refundRupees) || refundRupees <= 0) {
      setActionErr('Enter a positive refund amount.')
      return
    }
    if (refundRupees > order.displayTotal) {
      setActionErr(`Refund cannot exceed the order total (₹${order.displayTotal}).`)
      return
    }
    setActionErr(''); setBusy(true)
    try {
      await apiFetch(`/admin/orders/${encodeURIComponent(order.id)}/status`, {
        method: 'PATCH',
        body: {
          to: 'REFUNDED',
          refundAmount: Math.round(refundRupees * 100), // paise
          note: 'Refund issued.',
          notifyCustomer: true,
        },
      })
      setShowRefund(false)
      await onChanged()
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : 'Refund failed')
    } finally {
      setBusy(false)
    }
  }

  // ── RETURN_REQUESTED - show customer's reason + Approve / Decline ────
  if (order.status === 'RETURN_REQUESTED') {
    return (
      <div className="mb-6 rounded-xl border border-pink-200 bg-pink-50/70 p-4 md:p-6">
        <div className="flex items-start gap-3 mb-4">
          <RotateCcw className="w-5 h-5 text-pink-700 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h2 className="font-serif text-lg text-pink-900">Return requested</h2>
            <p className="text-sm text-pink-900/80 mt-0.5">
              Requested {order.returnRequestedAt ? formatDate(order.returnRequestedAt) : 'recently'}.
              Review the reason below and decide.
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm mb-4">
          <div>
            <dt className="text-xs uppercase tracking-wider text-pink-900/60 mb-1">Reason</dt>
            <dd className="text-pink-900 font-medium">
              {order.returnReason ? (RETURN_REASON_LABEL[order.returnReason] || order.returnReason) : '-'}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wider text-pink-900/60 mb-1">Customer comment</dt>
            <dd className="text-pink-900">{order.returnComment || <span className="text-pink-900/60">-</span>}</dd>
          </div>
        </dl>

        {(order.returnPhotos?.length ?? 0) > 0 && (
          <div className="mb-4">
            <p className="text-xs uppercase tracking-wider text-pink-900/60 mb-2">Photos from customer</p>
            <div className="flex flex-wrap gap-2">
              {order.returnPhotos!.map((url) => (
                <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block w-20 h-20 rounded-lg overflow-hidden border border-pink-200">
                  <img src={url} alt="Return photo" className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button onClick={approveReturn} disabled={busy} className="btn-dark text-sm h-10 px-5 disabled:opacity-60">
            <CheckCircle2 className="w-4 h-4" />
            {busy ? 'Working…' : 'Approve return'}
          </button>
          <button
            onClick={() => setShowDecline(true)}
            disabled={busy}
            className="text-sm h-10 px-5 rounded-full border border-red-300 text-red-700 hover:bg-red-50 inline-flex items-center gap-2 disabled:opacity-60"
          >
            <XCircle className="w-4 h-4" /> Decline return
          </button>
        </div>

        {showDecline && (
          <DeclineReturnModal
            value={declineReason}
            onChange={setDeclineReason}
            onCancel={() => { setShowDecline(false); setDeclineReason('') }}
            onConfirm={declineReturn}
            busy={busy}
          />
        )}
      </div>
    )
  }

  // ── RETURNED - show "Issue refund" CTA ───────────────────────────────
  if (order.status === 'RETURNED') {
    return (
      <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50/70 p-4 md:p-6">
        <div className="flex items-start gap-3 mb-3">
          <Package className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h2 className="font-serif text-lg text-rose-900">Return received</h2>
            <p className="text-sm text-rose-900/80 mt-0.5">
              Item has been marked as received. Issue the refund whenever you&apos;ve verified the
              condition.
            </p>
          </div>
        </div>
        {order.refundFailureReason && (
          <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            <strong>Previous refund attempt failed:</strong> {order.refundFailureReason}
          </div>
        )}
        <button onClick={() => setShowRefund(true)} className="btn-dark text-sm h-10 px-5">
          <IndianRupee className="w-4 h-4" /> Issue refund
        </button>
        {showRefund && (
          <IssueRefundModal
            orderTotal={order.displayTotal}
            value={refundRupees}
            onChange={setRefundRupees}
            onCancel={() => setShowRefund(false)}
            onConfirm={issueRefund}
            busy={busy}
            paymentId={order.razorpayPaymentId}
          />
        )}
      </div>
    )
  }

  // ── REFUNDED - read-only summary ─────────────────────────────────────
  if (order.status === 'REFUNDED') {
    return (
      <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 md:p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h2 className="font-serif text-lg text-emerald-900">Refunded</h2>
            <p className="text-sm text-emerald-900/80 mt-0.5 tabular-nums">
              {order.refundAmount != null ? `${formatINR(order.refundAmount / 100)} refunded` : 'Refund issued'}
              {order.refundedAt ? ` on ${formatDate(order.refundedAt)}` : ''}.
            </p>
            {order.razorpayRefundId && (
              <p className="text-xs text-emerald-900/70 font-mono mt-1 break-all">
                Razorpay refund ID: {order.razorpayRefundId}
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── If a return was previously declined and the order is back at DELIVERED ─
  if (order.status === 'DELIVERED' && order.returnDeclineReason) {
    return (
      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50/70 p-4 md:p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900">A previous return request was declined</p>
            <p className="text-sm text-amber-900/90 mt-0.5">{order.returnDeclineReason}</p>
          </div>
        </div>
      </div>
    )
  }

  return null
}

function DeclineReturnModal({
  value, onChange, onCancel, onConfirm, busy,
}: {
  value: string
  onChange: (v: string) => void
  onCancel: () => void
  onConfirm: () => void
  busy: boolean
}) {
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm px-4" onClick={onCancel}>
      <div className="w-full max-w-md bg-cream rounded-2xl shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-serif text-xl text-ink mb-2">Decline return</h2>
        <p className="text-sm text-ink-soft mb-4">
          The customer will be notified with the reason you enter below. The order goes back to <strong>Delivered</strong>.
        </p>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={500}
          rows={4}
          placeholder="Explain why this return is being declined (e.g., outside the 7-day window, signs of use)."
          className="w-full px-4 py-3 rounded-xl border border-ink/15 bg-paper text-sm text-ink placeholder:text-ink-mute focus:outline-none focus:ring-2 focus:ring-lavender/30 focus:border-lavender/50 resize-none"
        />
        <p className="text-xs text-ink-mute mt-1">{value.length}/500</p>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onCancel} disabled={busy} className="text-sm h-10 px-4 rounded-full border border-ink/15 text-ink hover:bg-cream-deep disabled:opacity-60">Cancel</button>
          <button onClick={onConfirm} disabled={busy} className="btn-dark text-sm h-10 px-5 disabled:opacity-60">
            {busy ? 'Working…' : 'Decline return'}
          </button>
        </div>
      </div>
    </div>
  )
}

function IssueRefundModal({
  orderTotal, value, onChange, onCancel, onConfirm, busy, paymentId,
}: {
  orderTotal: number
  value: number
  onChange: (v: number) => void
  onCancel: () => void
  onConfirm: () => void
  busy: boolean
  paymentId?: string
}) {
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm px-4" onClick={onCancel}>
      <div className="w-full max-w-md bg-cream rounded-2xl shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-serif text-xl text-ink mb-2">Issue refund</h2>
        <p className="text-sm text-ink-soft mb-4">
          {paymentId
            ? 'This will call the Razorpay refund API and mark the order Refunded.'
            : 'No Razorpay payment id on this order - the refund will be recorded but no money will move via Razorpay. Use this for COD or manually settled orders.'}
        </p>
        <label className="block text-xs uppercase tracking-wider text-ink-mute mb-1.5">Refund amount (₹)</label>
        <input
          type="number"
          min={1}
          max={orderTotal}
          step={1}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
          className="w-full h-11 px-4 rounded-xl border border-ink/15 bg-paper text-sm text-ink tabular-nums focus:outline-none focus:ring-2 focus:ring-lavender/30 focus:border-lavender/50"
        />
        <p className="text-xs text-ink-mute mt-1">Max ₹{orderTotal} (the order total). Partial refunds are allowed.</p>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onCancel} disabled={busy} className="text-sm h-10 px-4 rounded-full border border-ink/15 text-ink hover:bg-cream-deep disabled:opacity-60">Cancel</button>
          <button onClick={onConfirm} disabled={busy} className="btn-dark text-sm h-10 px-5 disabled:opacity-60">
            {busy ? 'Working…' : `Refund ₹${value}`}
          </button>
        </div>
      </div>
    </div>
  )
}

function ErrorPanel({ msg }: { msg: string }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-start gap-3">
      <AlertCircle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
      <p className="text-sm text-red-700">{msg}</p>
    </div>
  )
}

export default function AdminOrderDetailPage() {
  return (
    <Suspense fallback={<div className="text-sm text-ink-mute"><Loader2 className="w-4 h-4 animate-spin inline" /> Loading…</div>}>
      <OrderDetail />
    </Suspense>
  )
}

// Inline note-only form. Posts to the standalone /notes endpoint so
// admins can leave context (e.g. "called customer, will ship Tue") without
// fabricating a status transition. The note shows up in the timeline on
// next refresh.
function AddInternalNote({ orderId, onAdded }: { orderId: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-4 text-xs text-lavender hover:text-lavender-pastel font-medium"
      >
        + Add internal note
      </button>
    )
  }

  return (
    <div className="mt-4 pt-4 border-t border-ink/10">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Internal note (visible to admins, recorded in timeline)"
        className="w-full px-3 py-2 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender resize-none"
      />
      {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
      <div className="flex justify-end gap-2 mt-2">
        <button
          onClick={() => { setOpen(false); setNote(''); setErr('') }}
          className="h-8 px-3 text-xs rounded-md text-ink-soft hover:text-ink"
        >
          Cancel
        </button>
        <button
          onClick={async () => {
            if (!note.trim()) { setErr('Note cannot be empty.'); return }
            setErr(''); setBusy(true)
            try {
              await apiFetch(`/admin/orders/${encodeURIComponent(orderId)}/notes`, {
                method: 'POST',
                body: { note: note.trim() },
              })
              setNote(''); setOpen(false); onAdded()
            } catch (e) {
              setErr(e instanceof Error ? e.message : 'Could not add note')
            } finally {
              setBusy(false)
            }
          }}
          disabled={busy}
          className="h-8 px-3 text-xs rounded-md bg-lavender text-white font-medium disabled:opacity-50 hover:bg-lavender/90"
        >
          {busy ? 'Adding…' : 'Add note'}
        </button>
      </div>
    </div>
  )
}

// ─── Notifications panel (invoice + email + WhatsApp) ─────────────
// Surfaces delivery status for the order_confirmed email and the
// order_confirmation_new_artwork WhatsApp template, with resend
// buttons that round-trip through the notifications queue (which is
// the single delivery path - admin actions never bypass it).

interface NotificationStatusProps {
  label: string
  status?: 'pending' | 'sent' | 'failed'
  at?: string
  error?: string
  attempts?: number
}

function NotificationStatusRow({ label, status, at, error, attempts }: NotificationStatusProps) {
  const tone =
    status === 'sent' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' :
    status === 'failed' ? 'bg-red-50 text-red-700 ring-red-600/20' :
    status === 'pending' ? 'bg-amber-50 text-amber-700 ring-amber-600/20' :
    'bg-zinc-50 text-zinc-600 ring-zinc-600/15'
  const label2 = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Not sent'
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <div className="text-ink-soft">{label}</div>
      <div className="text-right">
        <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full ring-1 ring-inset ${tone}`}>
          {label2}{typeof attempts === 'number' && attempts > 1 ? ` · ${attempts} tries` : ''}
        </span>
        {at && (
          <div className="text-[11px] text-ink-mute mt-1">{formatDate(at)}</div>
        )}
        {error && (
          <div className="text-[11px] text-red-600 mt-1 max-w-[16rem] truncate" title={error}>{error}</div>
        )}
      </div>
    </div>
  )
}

function NotificationsPanel({
  order,
  onChanged,
}: {
  order: AdminOrder
  onChanged: () => Promise<void> | void
}) {
  const [busyEmail, setBusyEmail] = useState(false)
  const [busyWa, setBusyWa] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const isPaid = (order.paymentStatus || '').toUpperCase() === 'CAPTURED'
  const downloadHref = order.invoiceUrl || `/invoices/${encodeURIComponent(order.id)}.pdf`

  async function resendEmail() {
    setMsg(null); setBusyEmail(true)
    try {
      await apiFetch(`/admin/orders/${encodeURIComponent(order.id)}/resend-email`, {
        method: 'POST',
      })
      setMsg({ kind: 'ok', text: 'Email re-queued. It will go out in a few seconds.' })
      await onChanged()
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Could not resend email' })
    } finally {
      setBusyEmail(false)
    }
  }

  async function resendWhatsApp() {
    setMsg(null); setBusyWa(true)
    try {
      await apiFetch(`/admin/orders/${encodeURIComponent(order.id)}/resend-whatsapp`, {
        method: 'POST',
      })
      setMsg({ kind: 'ok', text: 'WhatsApp re-queued. It will go out in a few seconds.' })
      await onChanged()
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Could not resend WhatsApp' })
    } finally {
      setBusyWa(false)
    }
  }

  return (
    <div className="bg-plum-light border border-ink/10 rounded-xl p-4 md:p-6">
      <h2 className="font-serif text-lg text-ink mb-1">Invoice &amp; notifications</h2>
      <p className="text-xs text-ink-mute mb-4">
        One PDF per order — used by Download, email attachment and WhatsApp.
      </p>

      <div className="space-y-3 mb-5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-soft">Invoice number</span>
          <span className="text-ink font-mono text-xs">{order.id}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-soft">Invoice PDF</span>
          {isPaid ? (
            <div className="flex items-center gap-2">
              <a
                href={downloadHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-3 py-1.5 rounded-md border border-ink/15 text-ink-soft hover:text-ink hover:bg-white/5 inline-flex items-center gap-1.5 transition-colors"
              >
                <Mail className="w-3.5 h-3.5" aria-hidden /> View
              </a>
              <a
                href={downloadHref}
                download={`invoice-${order.id}.pdf`}
                className="text-xs px-3 py-1.5 rounded-md bg-lavender text-white font-medium hover:bg-lavender/90 inline-flex items-center gap-1.5 transition-colors"
              >
                Download
              </a>
            </div>
          ) : (
            <span className="text-xs text-ink-mute">Available once payment captured</span>
          )}
        </div>
      </div>

      <div className="border-t border-ink/10 pt-4 space-y-3">
        <NotificationStatusRow
          label="Confirmation email"
          status={order.emailStatus}
          at={order.emailSentAt}
          error={order.emailLastError}
          attempts={order.emailAttempts}
        />
        <NotificationStatusRow
          label="WhatsApp confirmation"
          status={order.whatsappStatus}
          at={order.whatsappSentAt}
          error={order.whatsappLastError}
        />
      </div>

      <div className="border-t border-ink/10 pt-4 mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={resendEmail}
          disabled={!isPaid || busyEmail || !order.customerEmail}
          className="text-xs px-3 py-2 rounded-md border border-ink/15 text-ink-soft hover:text-ink hover:bg-white/5 inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title={!order.customerEmail ? 'No customer email on file' : ''}
        >
          {busyEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          Resend email
        </button>
        <button
          type="button"
          onClick={resendWhatsApp}
          disabled={!isPaid || busyWa || !order.customerPhone}
          className="text-xs px-3 py-2 rounded-md border border-ink/15 text-ink-soft hover:text-ink hover:bg-white/5 inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title={!order.customerPhone ? 'No customer phone on file' : ''}
        >
          {busyWa ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageSquare className="w-3.5 h-3.5" />}
          Resend WhatsApp
        </button>
      </div>

      {msg && (
        <div
          className={`mt-3 text-xs px-3 py-2 rounded-md ${
            msg.kind === 'ok'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {msg.text}
        </div>
      )}
    </div>
  )
}
