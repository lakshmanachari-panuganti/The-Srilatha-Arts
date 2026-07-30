'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Package, MapPin, Pencil, Truck, CheckCircle2,
  AlertCircle, Loader2, X,
} from 'lucide-react'
import { apiFetch, ApiError } from '@/lib/api'
import { useUserAuth } from '@/stores/userAuth'
import { formatINR } from '@/lib/format'
import PhotoUploader from '@/components/PhotoUploader'

// Mirrored from the backend toApi() shape in functions/orders.ts. Only the
// fields used by this page are typed; unknown fields ride along untouched
// if needed.
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
  subtotal?: number
  shippingAmount?: number
  discountAmount?: number
  couponCode?: string
  customerName: string
  customerEmail?: string
  customerPhone?: string
  shippingAddress?: ShippingAddress
  trackingNumber?: string
  courier?: string
  courierUrl?: string
  eta?: string
  cancelReason?: string
  addressEdited?: boolean
  returnReason?: string
  returnComment?: string
  returnRequestedAt?: string
  returnDeclineReason?: string
  refundAmount?: number
  refundedAt?: string
  createdAt: string
  updatedAt?: string
}
interface OrderItem {
  productId: string
  title: string
  category: string
  imageUrl: string
  price: number
  displayPrice: number
  qty: number
}
interface TimelineEvent {
  // status is optional because the backend may return note-only events
  // (e.g. "Shipping address updated") that have no status transition.
  status?: string
  fromStatus?: string
  note?: string
  by: string
  createdAt: string
}

const STATUS_LABEL: Record<string, string> = {
  PLACED: 'Order placed',
  CONFIRMED: 'Confirmed',
  CRAFTING: 'Being crafted',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  RETURN_REQUESTED: 'Return requested',
  RETURNED: 'Returned',
  REFUNDED: 'Refunded',
  CANCELLED: 'Cancelled',
  ON_HOLD: 'On hold',
}

// Mirror of backend services/orderState.ts CUSTOMER_CANCELLABLE so the UI
// only offers the action when the API will accept it. Keep in sync.
const CUSTOMER_CANCELLABLE = new Set(['PLACED', 'CONFIRMED', 'CRAFTING'])

const CANCEL_REASONS: { code: string; label: string }[] = [
  { code: 'changed_mind',     label: 'I changed my mind' },
  { code: 'found_better',     label: 'Found a different piece I prefer' },
  { code: 'delivery_too_long', label: 'Delivery time is too long' },
  { code: 'duplicate',        label: 'Ordered by mistake / duplicate' },
  { code: 'other',            label: 'Other reason' },
]

const RETURN_REASON_OPTIONS = [
  { code: 'damaged',          label: 'Item arrived damaged' },
  { code: 'wrong_item',       label: 'Wrong item delivered' },
  { code: 'not_as_described', label: 'Item is not as described / shown' },
  { code: 'size_issue',       label: 'Size or fit issue' },
  { code: 'quality_issue',    label: 'Quality is not what I expected' },
  { code: 'changed_mind',     label: 'I changed my mind' },
  { code: 'other',            label: 'Other reason' },
]
const RETURN_WINDOW_DAYS = 7
function withinReturnWindow(updatedAt?: string): boolean {
  if (!updatedAt) return false
  const t = new Date(updatedAt).getTime()
  if (Number.isNaN(t)) return false
  return (Date.now() - t) / (1000 * 60 * 60 * 24) <= RETURN_WINDOW_DAYS
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function OrderDetailClient() {
  const router = useRouter()
  const user = useUserAuth((s) => s.user)

  // Same pattern as PDP: SWA serves the shell HTML for all
  // /account/orders/* URLs; we read the id from the live pathname after
  // mount.
  const [id, setId] = useState<string | null>(null)
  // Zustand-persist rehydrates from localStorage asynchronously, so `user`
  // is null for the first paint even when the customer is signed in. Without
  // this gate the auth-required effect below redirects to /login on every
  // refresh / direct-link load before the store has a chance to populate.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    const parts = window.location.pathname.split('/').filter(Boolean)
    // /account/orders/<id>/  →  ['account','orders','<id>']
    setId(parts[2] ?? null)
    setHydrated(true)
  }, [])

  const [order, setOrder] = useState<Order | null>(null)
  const [items, setItems] = useState<OrderItem[]>([])
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState('')
  const [expired, setExpired] = useState(false)

  const [showCancel, setShowCancel] = useState(false)
  const [showAddress, setShowAddress] = useState(false)
  const [showReturn, setShowReturn] = useState(false)

  const refresh = useCallback(async () => {
    if (!id || id === '__shell__') return
    setLoadErr('')
    try {
      const [detail, timeline] = await Promise.all([
        apiFetch<{ order: Order; items: OrderItem[] }>(`/orders/${encodeURIComponent(id)}`),
        apiFetch<{ events: TimelineEvent[] }>(`/orders/${encodeURIComponent(id)}/events`).catch(
          // Timeline failure shouldn't blank the page - it's secondary info.
          () => ({ events: [] as TimelineEvent[] }),
        ),
      ])
      setOrder(detail.order)
      setItems(detail.items || [])
      setEvents(timeline.events || [])
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setExpired(true)
      } else if (e instanceof ApiError && e.status === 404) {
        setLoadErr('We couldn’t find this order under your account.')
      } else {
        setLoadErr(e instanceof Error ? e.message : 'Could not load this order')
      }
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    // Wait for the auth store to rehydrate before deciding what to do —
    // otherwise we'd redirect a logged-in customer to /login on every
    // direct page load.
    if (!hydrated) return
    if (id && id !== '__shell__' && !user) {
      router.replace('/login?next=' + encodeURIComponent(`/account/orders/${id}`))
      return
    }
    refresh()
  }, [hydrated, id, user, router, refresh])

  if (!hydrated || !id || id === '__shell__' || loading) {
    return (
      <main className="max-w-3xl mx-auto px-5 py-12 lg:py-20">
        <div className="flex items-center gap-2 text-sm text-ink-mute">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading order…
        </div>
      </main>
    )
  }
  if (expired) {
    return (
      <main className="max-w-3xl mx-auto px-5 py-12 lg:py-20">
        <div className="card p-8 text-center">
          <h2 className="font-serif text-2xl text-ink mb-2">Your session expired</h2>
          <p className="text-sm text-ink-soft mb-5">Please sign in again to see this order.</p>
          <Link href={`/login?next=${encodeURIComponent(`/account/orders/${id}`)}`} className="btn-dark">
            Sign in
          </Link>
        </div>
      </main>
    )
  }
  if (loadErr || !order) {
    return (
      <main className="max-w-3xl mx-auto px-5 py-12 lg:py-20">
        <Link href="/account" className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-lavender mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to my orders
        </Link>
        <div className="card p-6 text-sm text-red-600 bg-red-50 border-red-200">
          {loadErr || 'Order not found.'}
        </div>
      </main>
    )
  }

  const addr = order.shippingAddress || {}
  const canCancel = CUSTOMER_CANCELLABLE.has(order.status)
  const canEditAddress = order.status === 'PLACED' && !order.addressEdited
  const canReturn =
    order.status === 'DELIVERED' &&
    !order.returnRequestedAt &&
    withinReturnWindow(order.updatedAt || order.createdAt)

  return (
    <main className="max-w-4xl mx-auto px-5 lg:px-8 py-10 lg:py-16">
      <Link href="/account" className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-lavender mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to my orders
      </Link>

      <header className="flex items-start justify-between gap-4 flex-wrap mb-8">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-mute">Order</p>
          <h1 className="font-serif text-2xl lg:text-3xl text-ink tabular-nums">{order.id}</h1>
          <p className="text-sm text-ink-mute mt-1">Placed {formatDate(order.createdAt)}</p>
        </div>
        <div className="text-right">
          <StatusPill status={order.status} paymentStatus={order.paymentStatus} />
          <p className="font-serif text-xl font-semibold text-ink mt-2 tabular-nums">
            {formatINR(order.displayTotal)}
          </p>
        </div>
      </header>

      {/* Return / refund banners - same set the OrdersTab uses */}
      {order.status === 'RETURN_REQUESTED' && (
        <Banner tone="amber" title="Return request submitted">
          {order.returnReason && (
            <p>Reason: <strong>{order.returnReason}</strong></p>
          )}
          {order.returnComment && <p className="mt-1">&ldquo;{order.returnComment}&rdquo;</p>}
          <p className="text-xs mt-2">We&apos;re reviewing your request. We&apos;ll be in touch within 1–2 working days.</p>
        </Banner>
      )}
      {order.returnDeclineReason && order.status === 'DELIVERED' && (
        <Banner tone="red" title="Return request was declined">
          <p>{order.returnDeclineReason}</p>
        </Banner>
      )}
      {order.status === 'RETURNED' && (
        <Banner tone="emerald" title="Return received">
          Refund is being processed and will reach you in 5–7 working days.
        </Banner>
      )}
      {order.status === 'REFUNDED' && (
        <Banner tone="emerald" title="Refunded">
          <p className="tabular-nums">
            {order.refundAmount != null
              ? `${formatINR(order.refundAmount / 100)} refunded`
              : 'Refund processed'}
            {order.refundedAt ? ` on ${formatDate(order.refundedAt)}` : ''}.
          </p>
        </Banner>
      )}
      {order.status === 'CANCELLED' && order.cancelReason && (
        <Banner tone="red" title="Order cancelled">
          <p>Reason: {order.cancelReason}</p>
        </Banner>
      )}

      <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Left column: items + timeline */}
        <section className="lg:col-span-2 space-y-6">
          <Card title="Items">
            <ul className="divide-y divide-ink/8">
              {items.length === 0 && (
                <li className="py-4 text-sm text-ink-mute">No items found on this order.</li>
              )}
              {items.map((it) => (
                <li key={it.productId} className="py-4 flex gap-4 items-center">
                  {it.imageUrl ? (
                    <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-cream-deep shrink-0">
                      <Image src={it.imageUrl} alt={it.title} fill sizes="64px" className="object-cover" />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-cream-deep shrink-0 flex items-center justify-center text-ink-mute">
                      <Package className="w-5 h-5" aria-hidden />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/product/${it.productId}`}
                      className="font-serif text-base text-ink hover:text-lavender transition-colors line-clamp-2"
                    >
                      {it.title}
                    </Link>
                    <p className="text-xs text-ink-mute mt-0.5">Qty {it.qty} · {it.category?.replace('-', ' ')}</p>
                  </div>
                  <p className="text-sm text-ink font-medium tabular-nums shrink-0">
                    {formatINR(it.displayPrice * it.qty)}
                  </p>
                </li>
              ))}
            </ul>
          </Card>

          {events.length > 0 && (
            <Card title="Timeline">
              <ol className="relative pl-5 space-y-4">
                {events.map((ev, i) => (
                  <li key={i} className="relative">
                    <span
                      aria-hidden
                      className="absolute -left-[18px] top-1.5 w-2 h-2 rounded-full bg-lavender"
                    />
                    {i < events.length - 1 && (
                      <span
                        aria-hidden
                        className="absolute -left-[14px] top-4 bottom-[-1rem] w-px bg-ink/15"
                      />
                    )}
                    {/* Status events get a humanised label; note-only events
                        (address updates, etc.) use the note text as the title
                        and skip the duplicate detail line. Falling back to a
                        generic label keeps a future unknown event shape from
                        bubbling a TypeError into the global error boundary. */}
                    <p className="text-sm font-medium text-ink">
                      {ev.status
                        ? STATUS_LABEL[ev.status] || ev.status.replace(/_/g, ' ')
                        : ev.note || 'Update'}
                    </p>
                    {ev.status && ev.note && (
                      <p className="text-xs text-ink-mute mt-0.5">{ev.note}</p>
                    )}
                    <p className="text-xs text-ink-mute mt-0.5">
                      {ev.by} · {formatDateTime(ev.createdAt)}
                    </p>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </section>

        {/* Right column: address, payment, actions */}
        <aside className="space-y-6">
          <Card
            title="Shipping address"
            action={
              canEditAddress && (
                <button
                  onClick={() => setShowAddress(true)}
                  className="text-xs text-lavender hover:text-lavender-pastel inline-flex items-center gap-1"
                >
                  <Pencil className="w-3 h-3" /> Change
                </button>
              )
            }
          >
            <div className="text-sm text-ink-soft space-y-0.5">
              <p className="font-medium text-ink">{addr.fullName || order.customerName}</p>
              {addr.line1 && <p>{addr.line1}</p>}
              {addr.line2 && <p>{addr.line2}</p>}
              {(addr.city || addr.state || addr.pincode) && (
                <p>{[addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')}</p>
              )}
              {addr.phone && <p className="pt-1 text-xs text-ink-mute">{addr.phone}</p>}
              {order.addressEdited && (
                <p className="text-xs text-ink-mute pt-2">Address has been edited once.</p>
              )}
            </div>
          </Card>

          {(order.trackingNumber || order.courier || order.eta) && (
            <Card title="Shipping">
              <div className="text-sm text-ink-soft space-y-1">
                {order.courier && <p><span className="text-ink-mute">Courier:</span> {order.courier}</p>}
                {order.trackingNumber && (
                  <p>
                    <span className="text-ink-mute">Tracking:</span>{' '}
                    {order.courierUrl ? (
                      <a href={order.courierUrl} target="_blank" rel="noopener noreferrer" className="text-lavender hover:underline">
                        {order.trackingNumber}
                      </a>
                    ) : order.trackingNumber}
                  </p>
                )}
                {order.eta && <p><span className="text-ink-mute">ETA:</span> {order.eta}</p>}
              </div>
            </Card>
          )}

          <Card title="Payment">
            <dl className="text-sm space-y-1.5">
              {/* Backend stores subtotal / shipping / discount in PAISE, but
                  displayTotal is pre-converted to RUPEES. Divide by 100 so
                  all four numbers are in the same unit before formatINR. */}
              {order.subtotal != null && (
                <Row label="Subtotal" value={formatINR(order.subtotal / 100)} />
              )}
              {order.discountAmount != null && order.discountAmount > 0 && (
                <Row label={`Discount${order.couponCode ? ` (${order.couponCode})` : ''}`} value={`−${formatINR(order.discountAmount / 100)}`} />
              )}
              {order.shippingAmount != null && (
                <Row label="Shipping" value={order.shippingAmount === 0 ? 'Free' : formatINR(order.shippingAmount / 100)} />
              )}
              <div className="border-t border-ink/8 pt-1.5">
                <Row label="Total" value={formatINR(order.displayTotal)} bold />
              </div>
            </dl>
          </Card>

          {(canCancel || canReturn) && (
            <Card title="Actions">
              <div className="space-y-2">
                {canCancel && (
                  <button
                    onClick={() => setShowCancel(true)}
                    className="w-full text-sm h-10 px-4 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 transition-colors"
                  >
                    Cancel this order
                  </button>
                )}
                {canReturn && (
                  <button
                    onClick={() => setShowReturn(true)}
                    className="w-full text-sm h-10 px-4 rounded-lg border border-ink/15 text-ink hover:bg-cream-deep transition-colors"
                  >
                    Request a return
                  </button>
                )}
              </div>
            </Card>
          )}
        </aside>
      </div>

      {showCancel && (
        <CancelModal
          orderId={order.id}
          onClose={() => setShowCancel(false)}
          onCancelled={() => { setShowCancel(false); refresh() }}
        />
      )}
      {showAddress && (
        <AddressModal
          orderId={order.id}
          initial={addr}
          onClose={() => setShowAddress(false)}
          onSaved={() => { setShowAddress(false); refresh() }}
        />
      )}
      {showReturn && (
        <ReturnModal
          orderId={order.id}
          onClose={() => setShowReturn(false)}
          onSubmitted={() => { setShowReturn(false); refresh() }}
        />
      )}
    </main>
  )
}

// ─── Helpers ─────────────────────────────────────────────────

function StatusPill({ status, paymentStatus }: { status: string; paymentStatus: string }) {
  const cls = status === 'DELIVERED'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : status === 'CANCELLED' || status === 'REFUNDED'
      ? 'bg-red-50 text-red-700 border-red-200'
      : paymentStatus === 'PENDING'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-cream-deep text-ink border-ink/15'
  const label = STATUS_LABEL[status] || status
  return (
    <span className={`inline-flex items-center text-[11px] tracking-wider uppercase border rounded-md px-2.5 py-1 ${cls}`}>
      {paymentStatus === 'PENDING' ? 'Payment pending' : label}
    </span>
  )
}

function Card({
  title, action, children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="card p-5 lg:p-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs uppercase tracking-wider text-ink-mute font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-ink-soft">{label}</dt>
      <dd className={`tabular-nums ${bold ? 'font-semibold text-ink' : 'text-ink'}`}>{value}</dd>
    </div>
  )
}

function Banner({
  tone, title, children,
}: {
  tone: 'amber' | 'red' | 'emerald'
  title: string
  children: React.ReactNode
}) {
  const cls =
    tone === 'amber' ? 'border-amber-200 bg-amber-50 text-amber-900'
    : tone === 'red' ? 'border-red-200 bg-red-50 text-red-800'
    : 'border-emerald-200 bg-emerald-50 text-emerald-900'
  const icon = tone === 'emerald' ? CheckCircle2 : AlertCircle
  const Icon = icon
  return (
    <div className={`mb-6 rounded-lg border px-4 py-3 text-sm ${cls}`}>
      <p className="font-medium mb-1 flex items-center gap-2">
        <Icon className="w-4 h-4" aria-hidden /> {title}
      </p>
      <div className="text-sm">{children}</div>
    </div>
  )
}

// ─── Modals ──────────────────────────────────────────────────

function ModalShell({
  title, onClose, children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-cream-deep border border-ink/10 rounded-lg shadow-xl max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 w-8 h-8 rounded-lg hover:bg-white/5 flex items-center justify-center"
        >
          <X className="w-4 h-4" aria-hidden />
        </button>
        <h3 className="font-serif text-xl text-ink mb-4">{title}</h3>
        {children}
      </div>
    </div>
  )
}

function CancelModal({
  orderId, onClose, onCancelled,
}: {
  orderId: string
  onClose: () => void
  onCancelled: () => void
}) {
  const [reason, setReason] = useState<string>('changed_mind')
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function submit() {
    setErr(''); setBusy(true)
    try {
      const reasonLabel = CANCEL_REASONS.find((r) => r.code === reason)?.label || reason
      const fullReason = comment.trim() ? `${reasonLabel}: ${comment.trim()}` : reasonLabel
      await apiFetch(`/orders/${encodeURIComponent(orderId)}/cancel`, {
        method: 'POST',
        body: { reason: fullReason },
      })
      onCancelled()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not cancel order')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell title="Cancel this order" onClose={onClose}>
      <p className="text-sm text-ink-soft mb-4">
        Cancellation is free while we haven&apos;t shipped. After that, you can request a
        return instead.
      </p>
      <label className="block text-xs text-ink-mute mb-1.5 tracking-wider uppercase">
        Reason
      </label>
      <select
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="w-full h-11 px-3 rounded-lg border border-ink/15 bg-paper text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender/30 focus:border-lavender/50 mb-4"
      >
        {CANCEL_REASONS.map((r) => (
          <option key={r.code} value={r.code}>{r.label}</option>
        ))}
      </select>
      <label className="block text-xs text-ink-mute mb-1.5 tracking-wider uppercase">
        Tell us more (optional)
      </label>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        placeholder="Anything you'd like us to know"
        className="w-full px-3 py-2 rounded-lg border border-ink/15 bg-paper text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender/30 focus:border-lavender/50 resize-none mb-3"
      />
      {err && <p className="text-xs text-red-400 mb-3">{err}</p>}
      <div className="flex gap-2 justify-end">
        <button
          onClick={onClose}
          className="h-10 px-4 rounded-lg border border-ink/15 text-sm text-ink hover:bg-white/5"
        >
          Keep order
        </button>
        <button
          onClick={submit}
          disabled={busy}
          className="h-10 px-5 rounded-lg bg-rose-700 text-white text-sm font-medium disabled:opacity-50 hover:bg-rose-800"
        >
          {busy ? 'Cancelling…' : 'Cancel order'}
        </button>
      </div>
    </ModalShell>
  )
}

function AddressModal({
  orderId, initial, onClose, onSaved,
}: {
  orderId: string
  initial: ShippingAddress
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    fullName: initial.fullName || '',
    phone:    initial.phone || '',
    line1:    initial.line1 || '',
    line2:    initial.line2 || '',
    city:     initial.city || '',
    state:    initial.state || '',
    pincode:  initial.pincode || '',
    country:  initial.country || 'India',
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const onF = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((s) => ({ ...s, [k]: e.target.value }))

  async function submit() {
    setErr('')
    if (!form.fullName || !form.phone || !form.line1 || !form.city || !form.state || !form.pincode) {
      setErr('Please fill in name, phone, address, city, state, and pincode.')
      return
    }
    setBusy(true)
    try {
      await apiFetch(`/orders/${encodeURIComponent(orderId)}/address`, {
        method: 'PATCH',
        body: { shippingAddress: form },
      })
      onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not update address')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell title="Change shipping address" onClose={onClose}>
      <p className="text-xs text-ink-mute mb-4 inline-flex items-center gap-1.5">
        <MapPin className="w-3.5 h-3.5" /> You can edit this once, while we haven&apos;t confirmed it yet.
      </p>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <Input placeholder="Full name" value={form.fullName} onChange={onF('fullName')} />
        <Input placeholder="Phone" value={form.phone} onChange={onF('phone')} />
        <Input placeholder="Address line 1" value={form.line1} onChange={onF('line1')} className="col-span-2" />
        <Input placeholder="Address line 2 (optional)" value={form.line2} onChange={onF('line2')} className="col-span-2" />
        <Input placeholder="City" value={form.city} onChange={onF('city')} />
        <Input placeholder="State" value={form.state} onChange={onF('state')} />
        <Input placeholder="Pincode" value={form.pincode} onChange={onF('pincode')} />
        <Input placeholder="Country" value={form.country} onChange={onF('country')} />
      </div>
      {err && <p className="text-xs text-red-400 mb-3">{err}</p>}
      <div className="flex gap-2 justify-end">
        <button onClick={onClose} className="h-10 px-4 rounded-lg border border-ink/15 text-sm text-ink hover:bg-white/5">
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={busy}
          className="h-10 px-5 rounded-lg bg-lavender text-white text-sm font-medium disabled:opacity-50 hover:bg-lavender/90"
        >
          {busy ? 'Saving…' : 'Save address'}
        </button>
      </div>
    </ModalShell>
  )
}

function Input({
  className, ...rest
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...rest}
      className={`h-10 px-3 rounded-lg border border-ink/15 bg-paper text-sm text-ink placeholder:text-ink-mute focus:outline-none focus:ring-2 focus:ring-lavender/30 focus:border-lavender/50 ${className || ''}`}
    />
  )
}

function ReturnModal({
  orderId, onClose, onSubmitted,
}: {
  orderId: string
  onClose: () => void
  onSubmitted: () => void
}) {
  const [reason, setReason] = useState<string>('damaged')
  const [comment, setComment] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function submit() {
    setErr('')
    if (reason === 'other' && !comment.trim()) {
      setErr('Please tell us a bit about the issue.')
      return
    }
    setBusy(true)
    try {
      await apiFetch(`/orders/${encodeURIComponent(orderId)}/return`, {
        method: 'POST',
        body: { reason, comment: comment.trim() || undefined, photos },
      })
      onSubmitted()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not submit return request')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell title="Request a return" onClose={onClose}>
      <label className="block text-xs text-ink-mute mb-1.5 tracking-wider uppercase">Reason</label>
      <select
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="w-full h-11 px-3 rounded-lg border border-ink/15 bg-paper text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender/30 focus:border-lavender/50 mb-3"
      >
        {RETURN_REASON_OPTIONS.map((r) => (
          <option key={r.code} value={r.code}>{r.label}</option>
        ))}
      </select>
      <label className="block text-xs text-ink-mute mb-1.5 tracking-wider uppercase">
        Tell us more {reason === 'other' && <span className="normal-case text-red-400">*</span>}
      </label>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        placeholder="Anything that'll help us understand the issue"
        className="w-full px-3 py-2 rounded-lg border border-ink/15 bg-paper text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender/30 focus:border-lavender/50 resize-none mb-3"
      />
      <PhotoUploader
        value={photos}
        onChange={setPhotos}
        max={6}
        label="Photos (optional)"
        hint="Photos help us resolve damage / wrong-item claims faster."
      />
      {err && <p className="text-xs text-red-400 mb-3 mt-3">{err}</p>}
      <div className="flex gap-2 justify-end">
        <button onClick={onClose} className="h-10 px-4 rounded-lg border border-ink/15 text-sm text-ink hover:bg-white/5">
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={busy}
          className="h-10 px-5 rounded-lg bg-lavender text-white text-sm font-medium disabled:opacity-50 hover:bg-lavender/90"
        >
          {busy ? 'Submitting…' : 'Submit request'}
        </button>
      </div>
    </ModalShell>
  )
}
