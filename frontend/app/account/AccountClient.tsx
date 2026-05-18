'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Package, MapPin, LogOut, Heart, ChevronRight,
  Pencil, Trash2, Plus, Check,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useUserAuth } from '@/stores/userAuth'
import { formatINR } from '@/lib/format'

interface SavedAddress {
  id: string
  label: string
  fullName: string
  phone: string
  line1: string
  line2?: string
  city: string
  state: string
  pincode: string
  isDefault: boolean
  createdAt: string
}

interface OrderSummary {
  id: string
  status: string
  paymentStatus: string
  displayTotal: number
  customerName: string
  createdAt: string
  // Return / refund metadata exposed by toApi() on the backend.
  returnRequestedAt?: string
  returnReason?: string
  returnComment?: string
  returnPhotos?: string[]
  returnDeclineReason?: string
  refundedAt?: string
  refundAmount?: number
  razorpayPaymentId?: string
  razorpayRefundId?: string
  updatedAt?: string
}

const RETURN_REASON_OPTIONS: { code: string; label: string }[] = [
  { code: 'damaged',          label: 'Item arrived damaged' },
  { code: 'wrong_item',       label: 'Wrong item delivered' },
  { code: 'not_as_described', label: 'Item is not as described / shown' },
  { code: 'size_issue',       label: 'Size or fit issue' },
  { code: 'quality_issue',    label: 'Quality is not what I expected' },
  { code: 'changed_mind',     label: 'I changed my mind' },
  { code: 'other',            label: 'Other reason' },
]
const RETURN_REASON_LABEL: Record<string, string> =
  Object.fromEntries(RETURN_REASON_OPTIONS.map((o) => [o.code, o.label]))

// Window the customer can request a return in, mirrored from the
// backend's canCustomerReturn() (services/orderState.ts).
const RETURN_WINDOW_DAYS = 7
function withinReturnWindow(updatedAt?: string): boolean {
  if (!updatedAt) return false
  const t = new Date(updatedAt).getTime()
  if (Number.isNaN(t)) return false
  return (Date.now() - t) / (1000 * 60 * 60 * 24) <= RETURN_WINDOW_DAYS
}

type Tab = 'orders' | 'addresses' | 'profile'

interface AddressForm {
  fullName: string
  phone: string
  line1: string
  line2: string
  city: string
  state: string
  pincode: string
  label: string
  isDefault: boolean
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

function emptyAddress(): AddressForm {
  return {
    fullName: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '',
    label: 'Home', isDefault: false,
  }
}

export default function AccountClient() {
  const router = useRouter()
  const user = useUserAuth((s) => s.user)
  const logout = useUserAuth((s) => s.logout)
  const [tab, setTab] = useState<Tab>('orders')
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => setHydrated(true), [])

  // Auth gate: not signed in → /login?next=/account
  useEffect(() => {
    if (hydrated && !user) router.replace('/login?next=' + encodeURIComponent('/account'))
  }, [hydrated, user, router])

  if (!hydrated || !user) {
    return (
      <main className="min-h-svh max-w-2xl mx-auto px-5 py-20 text-center">
        <div className="animate-pulse text-ink-mute">Loading your account…</div>
      </main>
    )
  }

  return (
    <main className="max-w-6xl mx-auto px-5 lg:px-8 py-10 lg:py-16">
      <header className="mb-8">
        <p className="eyebrow mb-3">Account</p>
        <h1 className="display text-4xl lg:text-5xl">
          Hi, <em className="italic">{user.name.split(' ')[0]}</em>
        </h1>
        <p className="text-ink-soft mt-2 text-sm">{user.email}</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* ── Sidebar nav ─────────────────────────────────────── */}
        <nav className="lg:col-span-1">
          <ul className="flex lg:flex-col gap-1 overflow-x-auto scrollbar-hide -mx-5 px-5 lg:mx-0 lg:px-0 pb-3 lg:pb-0">
            <SideTab active={tab === 'orders'}    onClick={() => setTab('orders')}    icon={Package} label="Orders" />
            <SideTab active={tab === 'addresses'} onClick={() => setTab('addresses')} icon={MapPin}  label="Addresses" />
            <SideTab active={tab === 'profile'}   onClick={() => setTab('profile')}   icon={Pencil}  label="Profile" />
            <li className="hidden lg:block pt-3 mt-2 border-t border-ink/10">
              <Link href="/account/wishlist" className="flex items-center gap-3 px-3 py-2.5 text-sm text-ink-soft rounded-lg hover:bg-cream-deep hover:text-ink">
                <Heart className="w-4 h-4" aria-hidden /> Wishlist
                <ChevronRight className="w-3.5 h-3.5 ml-auto" aria-hidden />
              </Link>
            </li>
            <li className="hidden lg:block">
              <button
                onClick={async () => { await logout(); router.replace('/') }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-terracotta rounded-lg hover:bg-terracotta/10"
              >
                <LogOut className="w-4 h-4" aria-hidden /> Sign out
              </button>
            </li>
          </ul>
        </nav>

        {/* ── Tab content ─────────────────────────────────────── */}
        <section className="lg:col-span-3 space-y-6">
          {tab === 'orders' && <OrdersTab />}
          {tab === 'addresses' && <AddressesTab />}
          {tab === 'profile' && <ProfileTab />}

          {/* Mobile sign-out */}
          <div className="lg:hidden pt-3">
            <button
              onClick={async () => { await logout(); router.replace('/') }}
              className="w-full text-sm text-terracotta inline-flex items-center justify-center gap-2 h-11 rounded-full border border-terracotta/30 hover:bg-terracotta/5"
            >
              <LogOut className="w-4 h-4" aria-hidden /> Sign out
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}

// ─── Sidebar tab pill ────────────────────────────────────────

function SideTab({
  active, onClick, icon: Icon, label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ComponentType<{ className?: string }>
  label: string
}) {
  return (
    <li className="shrink-0">
      <button
        onClick={onClick}
        aria-current={active ? 'page' : undefined}
        className={`whitespace-nowrap flex items-center gap-3 px-4 lg:px-3 py-2.5 text-sm rounded-full lg:rounded-lg transition-colors ${
          active
            ? 'bg-terracotta text-white lg:bg-cream-deep lg:text-ink font-medium'
            : 'bg-cream-deep/60 text-ink-soft hover:text-ink lg:bg-transparent'
        }`}
      >
        <Icon className="w-4 h-4" aria-hidden />
        {label}
      </button>
    </li>
  )
}

// ─── Orders tab ──────────────────────────────────────────────

function OrdersTab() {
  const [orders, setOrders] = useState<OrderSummary[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    apiFetch<{ orders: OrderSummary[] }>('/my-orders')
      .then((r) => setOrders(r.orders))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load orders'))
  }, [])

  if (error) {
    return <div className="card p-6 text-sm text-red-600 bg-red-50 border-red-200">{error}</div>
  }

  if (orders === null) {
    return (
      <div className="card p-8 text-center text-ink-mute animate-pulse">Loading orders…</div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="card p-10 text-center">
        <Package className="w-8 h-8 text-ink/20 mx-auto mb-3" aria-hidden />
        <h2 className="font-serif text-2xl text-ink mb-2">No orders yet</h2>
        <p className="text-sm text-ink-soft mb-5">Once you place an order, you’ll see it here.</p>
        <Link href="/shop" className="btn-dark">Start shopping</Link>
      </div>
    )
  }

  return (
    <>
      <ul className="space-y-3">
        {orders.map((o) => (
          <OrderCard
            key={o.id}
            order={o}
            onChanged={(next) => {
              setOrders((prev) => (prev || []).map((x) => (x.id === next.id ? { ...x, ...next } : x)))
            }}
          />
        ))}
      </ul>
    </>
  )
}

function OrderCard({
  order,
  onChanged,
}: {
  order: OrderSummary
  onChanged: (next: Partial<OrderSummary> & { id: string }) => void
}) {
  const [showReturn, setShowReturn] = useState(false)
  const canReturn =
    order.status === 'DELIVERED' &&
    !order.returnRequestedAt &&
    withinReturnWindow(order.updatedAt || order.createdAt)

  return (
    <li className="card p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-mute">Order</p>
          <p className="font-serif text-lg text-ink tabular-nums">{order.id}</p>
          <p className="text-xs text-ink-mute mt-1">
            {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <div className="text-right">
          <StatusPill status={order.status} paymentStatus={order.paymentStatus} />
          <p className="font-serif text-lg font-semibold text-ink mt-1 tabular-nums">{formatINR(order.displayTotal)}</p>
        </div>
      </div>

      {/* Return / refund context strip — shown only when applicable */}
      {order.status === 'RETURN_REQUESTED' && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium mb-1">Return request submitted</p>
          {order.returnReason && (
            <p>Reason: <strong>{RETURN_REASON_LABEL[order.returnReason] || order.returnReason}</strong></p>
          )}
          {order.returnComment && <p className="mt-1 text-amber-800">&ldquo;{order.returnComment}&rdquo;</p>}
          <p className="text-xs mt-2">We&apos;re reviewing your request. We&apos;ll be in touch within 1–2 working days.</p>
        </div>
      )}
      {order.returnDeclineReason && order.status === 'DELIVERED' && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-medium mb-1">Return request was declined</p>
          <p>{order.returnDeclineReason}</p>
          <p className="text-xs mt-2">If you have questions, please <Link href="/contact" className="underline">contact us</Link>.</p>
        </div>
      )}
      {order.status === 'RETURNED' && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Return received. Refund is being processed and will reach you in 5–7 working days.
        </div>
      )}
      {order.status === 'REFUNDED' && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p className="font-medium">Refunded</p>
          <p className="tabular-nums">
            {order.refundAmount != null
              ? `${formatINR(order.refundAmount / 100)} refunded`
              : 'Refund processed'}
            {order.refundedAt
              ? ` on ${new Date(order.refundedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
              : ''}
            .
          </p>
        </div>
      )}

      {/* Customer action: Request return — shown only when within window */}
      {canReturn && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => setShowReturn(true)}
            className="text-sm h-10 px-4 rounded-full border border-ink/15 text-ink hover:bg-cream-deep inline-flex items-center gap-2"
          >
            Request a return
          </button>
        </div>
      )}

      {showReturn && (
        <ReturnRequestModal
          orderId={order.id}
          onClose={() => setShowReturn(false)}
          onSubmitted={(updates) => {
            onChanged({ id: order.id, ...updates })
            setShowReturn(false)
          }}
        />
      )}
    </li>
  )
}

function ReturnRequestModal({
  orderId,
  onClose,
  onSubmitted,
}: {
  orderId: string
  onClose: () => void
  onSubmitted: (updates: Partial<OrderSummary>) => void
}) {
  const [reason, setReason] = useState<string>('damaged')
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function submit() {
    setErr('')
    if (!reason) { setErr('Please pick a reason.'); return }
    if (reason === 'other' && !comment.trim()) {
      setErr('Please tell us a bit about the issue.')
      return
    }
    setBusy(true)
    try {
      await apiFetch<{ ok: true; status: string; reason: string }>(`/orders/${orderId}/return`, {
        method: 'POST',
        body: {
          reason,
          comment: comment.trim() || undefined,
          photos: [], // photo upload not wired into this modal yet
        },
      })
      onSubmitted({
        status: 'RETURN_REQUESTED',
        returnReason: reason,
        returnComment: comment.trim() || undefined,
        returnRequestedAt: new Date().toISOString(),
      })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not submit the return request.')
      setBusy(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="return-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-cream rounded-2xl shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="return-modal-title" className="font-serif text-2xl text-ink mb-1">Request a return</h2>
        <p className="text-sm text-ink-soft mb-5">
          Order <span className="font-medium tabular-nums">{orderId}</span>
        </p>

        <label className="block text-xs uppercase tracking-wider text-ink-mute mb-2">
          Reason for return
        </label>
        <div className="space-y-2 mb-4">
          {RETURN_REASON_OPTIONS.map((o) => (
            <label
              key={o.code}
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                reason === o.code
                  ? 'border-terracotta/60 bg-cream-deep/60'
                  : 'border-ink/10 hover:border-ink/20'
              }`}
            >
              <input
                type="radio"
                name="return-reason"
                value={o.code}
                checked={reason === o.code}
                onChange={() => setReason(o.code)}
                className="mt-1 accent-terracotta"
              />
              <span className="text-sm text-ink">{o.label}</span>
            </label>
          ))}
        </div>

        <label className="block text-xs uppercase tracking-wider text-ink-mute mb-1.5">
          Comment {reason === 'other' && <span className="text-red-500">*</span>}
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={1000}
          rows={4}
          placeholder="Add any details that help us understand the issue."
          className="w-full px-4 py-3 rounded-xl border border-ink/15 bg-paper text-sm text-ink placeholder:text-ink-mute focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta/50 resize-none"
        />
        <p className="text-xs text-ink-mute mt-1">{comment.length}/1000</p>

        {err && (
          <div className="mt-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 px-3 py-2">{err}</div>
        )}

        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="text-sm h-10 px-4 rounded-full border border-ink/15 text-ink hover:bg-cream-deep disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="btn-dark text-sm h-10 px-5 disabled:opacity-60"
          >
            {busy ? 'Submitting…' : 'Submit return request'}
          </button>
        </div>
      </div>
    </div>
  )
}

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
    <span className={`inline-flex items-center text-[11px] tracking-wider uppercase border rounded-full px-2.5 py-1 ${cls}`}>
      {paymentStatus === 'PENDING' ? 'Payment pending' : label}
    </span>
  )
}

// ─── Addresses tab ───────────────────────────────────────────

function AddressesTab() {
  const [addresses, setAddresses] = useState<SavedAddress[] | null>(null)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<AddressForm>(emptyAddress())
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    try {
      const r = await apiFetch<{ addresses: SavedAddress[] }>('/addresses')
      setAddresses(r.addresses)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load addresses')
    }
  }

  const validation = useMemo(() => {
    if (!form.fullName.trim()) return 'Full name is required'
    if (!/^[+\d][\d\s-]{7,19}$/.test(form.phone.trim())) return 'Valid phone is required'
    if (!form.line1.trim()) return 'Address line 1 is required'
    if (!form.city.trim()) return 'City is required'
    if (!form.state.trim()) return 'State is required'
    if (!/^\d{6}$/.test(form.pincode.trim())) return 'Pincode must be 6 digits'
    return null
  }, [form])

  async function handleSave() {
    setError('')
    if (validation) { setError(validation); return }
    setBusy(true)
    try {
      const body = {
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        line1: form.line1.trim(),
        line2: form.line2.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode.trim(),
        label: form.label.trim() || 'Home',
        isDefault: form.isDefault,
      }
      if (editingId) {
        await apiFetch<{ address: SavedAddress }>(`/addresses/${editingId}`, { method: 'PATCH', body })
      } else {
        await apiFetch<{ address: SavedAddress }>('/addresses', { method: 'POST', body })
      }
      setForm(emptyAddress())
      setAdding(false)
      setEditingId(null)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save address')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this address?')) return
    try {
      await apiFetch(`/addresses/${id}`, { method: 'DELETE' })
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove address')
    }
  }

  function startEdit(a: SavedAddress) {
    setEditingId(a.id)
    setAdding(false)
    setForm({
      fullName: a.fullName, phone: a.phone, line1: a.line1, line2: a.line2 || '',
      city: a.city, state: a.state, pincode: a.pincode,
      label: a.label || 'Home', isDefault: a.isDefault,
    })
    setError('')
  }

  if (addresses === null) {
    return <div className="card p-8 text-center text-ink-mute animate-pulse">Loading addresses…</div>
  }

  const showingForm = adding || editingId

  return (
    <div className="space-y-4">
      {error && (
        <div role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {addresses.length === 0 && !showingForm && (
        <div className="card p-10 text-center">
          <MapPin className="w-8 h-8 text-ink/20 mx-auto mb-3" aria-hidden />
          <h2 className="font-serif text-2xl text-ink mb-2">No saved addresses</h2>
          <p className="text-sm text-ink-soft mb-5">Save an address now and we’ll fill it in on every future order.</p>
          <button onClick={() => { setAdding(true); setForm(emptyAddress()) }} className="btn-dark">
            <Plus className="w-4 h-4" aria-hidden /> Add address
          </button>
        </div>
      )}

      {addresses.length > 0 && (
        <ul className="space-y-3">
          {addresses.map((a) => (
            <li key={a.id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-ink">{a.fullName}</p>
                    <span className="text-[10px] tracking-wider uppercase text-ink-mute bg-cream-deep rounded-full px-2 py-0.5">
                      {a.label || 'Home'}
                    </span>
                    {a.isDefault && (
                      <span className="text-[10px] tracking-wider uppercase text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-ink-soft mt-1">
                    {a.line1}{a.line2 ? `, ${a.line2}` : ''}<br />
                    {a.city}, {a.state} {a.pincode}<br />
                    <span className="text-ink-mute">{a.phone}</span>
                  </p>
                </div>
                <div className="flex flex-col gap-1 -mt-1">
                  <button onClick={() => startEdit(a)} aria-label="Edit address" className="p-2 text-ink-mute hover:text-terracotta">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(a.id)} aria-label="Remove address" className="p-2 text-ink-mute hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Add / edit form */}
      {showingForm ? (
        <div className="card p-6">
          <h3 className="font-serif text-xl text-ink mb-4">
            {editingId ? 'Edit address' : 'New address'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AField id="af-name"   label="Full name" required value={form.fullName} onChange={(v) => setForm({ ...form, fullName: v })} />
            <AField id="af-phone"  label="Phone"     required type="tel" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
            <div className="sm:col-span-2">
              <AField id="af-l1" label="Address line 1" required value={form.line1} onChange={(v) => setForm({ ...form, line1: v })} />
            </div>
            <div className="sm:col-span-2">
              <AField id="af-l2" label="Address line 2" value={form.line2} onChange={(v) => setForm({ ...form, line2: v })} />
            </div>
            <AField id="af-city"  label="City"   required value={form.city}  onChange={(v) => setForm({ ...form, city: v })} />
            <AField id="af-state" label="State"  required value={form.state} onChange={(v) => setForm({ ...form, state: v })} />
            <AField id="af-pin"   label="Pincode" required inputMode="numeric" maxLength={6} value={form.pincode} onChange={(v) => setForm({ ...form, pincode: v })} />
            <AField id="af-label" label="Label (Home, Work, …)" value={form.label} onChange={(v) => setForm({ ...form, label: v })} />
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm text-ink-soft cursor-pointer">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
              className="accent-terracotta"
            />
            Set as default address
          </label>

          <div className="flex gap-2 mt-5">
            <button onClick={handleSave} disabled={busy} className="btn-dark text-sm h-10 px-4 disabled:opacity-60">
              <Check className="w-4 h-4" aria-hidden /> {busy ? 'Saving…' : editingId ? 'Save changes' : 'Add address'}
            </button>
            <button
              onClick={() => { setAdding(false); setEditingId(null); setForm(emptyAddress()); setError('') }}
              className="text-sm h-10 px-4 rounded-full border border-ink/15 text-ink hover:bg-cream-deep"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : addresses.length > 0 ? (
        <button onClick={() => { setAdding(true); setForm(emptyAddress()) }} className="btn-outline text-sm">
          <Plus className="w-4 h-4" aria-hidden /> Add another address
        </button>
      ) : null}
    </div>
  )
}

function AField(props: {
  id: string
  label: string
  required?: boolean
  type?: string
  value: string
  onChange: (v: string) => void
  inputMode?: 'numeric' | 'text' | 'tel' | 'email'
  maxLength?: number
}) {
  return (
    <div>
      <label htmlFor={props.id} className="block text-xs uppercase tracking-wider text-ink-mute mb-1">
        {props.label}{props.required && <span className="text-red-400"> *</span>}
      </label>
      <input
        id={props.id}
        type={props.type || 'text'}
        required={props.required}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        inputMode={props.inputMode}
        maxLength={props.maxLength}
        className="w-full h-11 px-4 rounded-xl border border-ink/15 bg-paper text-sm text-ink placeholder:text-ink-mute focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta/50"
      />
    </div>
  )
}

// ─── Profile tab ─────────────────────────────────────────────

function ProfileTab() {
  const user = useUserAuth((s) => s.user)
  const completeProfile = useUserAuth((s) => s.completeProfile)
  const [name, setName] = useState(user?.name || '')
  const [phone, setPhone] = useState(user?.phone || '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  if (!user) return null

  async function handleSave() {
    setErr(''); setMsg(''); setBusy(true)
    const ok = await completeProfile(name.trim(), phone.trim())
    setBusy(false)
    if (ok) setMsg('Profile updated.')
    else setErr(useUserAuth.getState().error || 'Could not update profile.')
  }

  return (
    <div className="card p-6 lg:p-7 max-w-xl">
      <h2 className="font-serif text-2xl mb-5">Your profile</h2>
      <dl className="text-sm mb-6 space-y-2">
        <div className="flex justify-between"><dt className="text-ink-mute">Email</dt><dd className="text-ink">{user.email}</dd></div>
      </dl>
      <div className="grid grid-cols-1 gap-3">
        <AField id="pf-name" label="Name" required value={name} onChange={setName} />
        <AField id="pf-phone" label="Phone" type="tel" value={phone} onChange={setPhone} />
      </div>
      {msg && <p className="text-sm text-emerald-700 mt-3">{msg}</p>}
      {err && <p className="text-sm text-red-600 mt-3">{err}</p>}
      <button onClick={handleSave} disabled={busy} className="btn-dark text-sm h-10 px-4 mt-5 disabled:opacity-60">
        <Check className="w-4 h-4" aria-hidden /> {busy ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  )
}
