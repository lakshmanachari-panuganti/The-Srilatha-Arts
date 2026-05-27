'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  ArrowRight, Lock, ShieldCheck, Truck,
  Pencil, Trash2, Plus, Check, X as XIcon,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useCart, cartSubtotal } from '@/stores/cart'
import { useUserAuth } from '@/stores/userAuth'
import { formatINR } from '@/lib/format'

// Fallback values until /api/shipping-settings resolves.
const FALLBACK_SHIPPING_BASE_RS = 99
const FALLBACK_FREE_THRESHOLD_RS = 2999

interface ShippingConfigApi {
  shipping: {
    baseCharge: number
    effectiveCharge: number
    freeThreshold: number
    discountLabel?: string
  }
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance
  }
}

interface RazorpayOptions {
  key: string
  amount: number
  currency: string
  name: string
  description?: string
  image?: string                  // business logo (https URL)
  order_id: string
  prefill?: { name?: string; email?: string; contact?: string }
  theme?: { color?: string; backdrop_color?: string; hide_topbar?: boolean }
  notes?: Record<string, string>
  // Per-method opt-in. Razorpay only shows a method if it's both enabled on
  // the merchant account AND not explicitly set to false here.
  method?: {
    upi?: boolean
    card?: boolean
    netbanking?: boolean
    wallet?: boolean
    emi?: boolean
    paylater?: boolean
    qr?: boolean
  }
  // Custom display config (block-based) — used to feature UPI at the top.
  config?: {
    display?: {
      blocks?: Record<string, {
        name?: string
        instruments?: Array<{ method: string; flows?: string[] }>
      }>
      sequence?: string[]
      preferences?: { show_default_blocks?: boolean }
    }
  }
  retry?: { enabled?: boolean; max_count?: number }
  timeout?: number                // seconds before Checkout auto-closes
  remember_customer?: boolean
  send_sms_hash?: boolean
  callback_url?: string
  handler: (response: {
    razorpay_payment_id: string
    razorpay_order_id: string
    razorpay_signature: string
  }) => void
  modal?: {
    ondismiss?: () => void
    escape?: boolean
    confirm_close?: boolean
    backdropclose?: boolean
    handleback?: boolean
    animation?: boolean
  }
}

interface RazorpayFailureResponse {
  error: {
    code: string
    description: string
    source: string
    step: string
    reason: string
    metadata: {
      order_id?: string
      payment_id?: string
    }
  }
}
interface RazorpayInstance {
  open: () => void
  on: (event: string, cb: (err: unknown) => void) => void
}

interface ShippingForm {
  fullName: string
  phone: string
  email: string
  line1: string
  line2: string
  city: string
  state: string
  pincode: string
}

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

function emptyShipping(): ShippingForm {
  return { fullName: '', phone: '', email: '', line1: '', line2: '', city: '', state: '', pincode: '' }
}

function shippingFromSaved(a: SavedAddress, email: string): ShippingForm {
  return {
    fullName: a.fullName,
    phone: a.phone,
    email,
    line1: a.line1,
    line2: a.line2 || '',
    city: a.city,
    state: a.state,
    pincode: a.pincode,
  }
}

const CHECKOUT_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js'
// Sentinel selectedId value meaning "I'm entering a new address". Using a
// fixed non-uuid string keeps the radio model simple.
const NEW_ADDRESS_ID = '__new__'

export default function CheckoutClient() {
  const router = useRouter()
  const items = useCart((s) => s.items)
  const hydrated = useCart((s) => s.hydrated)
  const clear = useCart((s) => s.clear)
  const user = useUserAuth((s) => s.user)

  // Auth gate: /checkout is only meaningful for signed-in users. Send the
  // unauthenticated user to /login and bring them right back here.
  useEffect(() => {
    if (!hydrated) return
    if (!user) router.replace('/login?next=' + encodeURIComponent('/checkout'))
  }, [hydrated, user, router])

  const [form, setForm] = useState<ShippingForm>(emptyShipping)
  const [saveNewAddress, setSaveNewAddress] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [scriptReady, setScriptReady] = useState(false)
  const [success, setSuccess] = useState<{ orderId: string } | null>(null)

  const [addresses, setAddresses] = useState<SavedAddress[] | null>(null)
  const [selectedId, setSelectedId] = useState<string>(NEW_ADDRESS_ID)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<ShippingForm>(emptyShipping)
  const [editBusy, setEditBusy] = useState(false)

  // Admin-configurable shipping. Until the API call resolves we use the
  // legacy hardcoded defaults so first paint isn't blank.
  const [shippingBaseRs, setShippingBaseRs] = useState(FALLBACK_SHIPPING_BASE_RS)
  const [shippingEffectiveRs, setShippingEffectiveRs] = useState(FALLBACK_SHIPPING_BASE_RS)
  const [freeThresholdRs, setFreeThresholdRs] = useState(FALLBACK_FREE_THRESHOLD_RS)
  const [shippingDiscountLabel, setShippingDiscountLabel] = useState<string | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    apiFetch<ShippingConfigApi>('/shipping-settings')
      .then((r) => {
        if (cancelled) return
        setShippingBaseRs(r.shipping.baseCharge / 100)
        setShippingEffectiveRs(r.shipping.effectiveCharge / 100)
        setFreeThresholdRs(r.shipping.freeThreshold / 100)
        setShippingDiscountLabel(r.shipping.discountLabel)
      })
      .catch(() => { /* keep fallback */ })
    return () => { cancelled = true }
  }, [])

  const subtotal = cartSubtotal(items)
  const shipping =
    subtotal === 0
      ? 0
      : subtotal >= freeThresholdRs
        ? 0
        : shippingEffectiveRs
  const total = subtotal + shipping
  const adminShippingDiscountActive = shippingEffectiveRs < shippingBaseRs && shipping > 0

  // Prefill name/phone/email from the signed-in user on first render.
  useEffect(() => {
    if (!user) return
    setForm((f) => ({
      ...f,
      fullName: f.fullName || user.name || '',
      email: f.email || user.email || '',
      phone: f.phone || user.phone || '',
    }))
  }, [user])

  // Fetch saved addresses. If any exist, default to the user's default
  // address (or the first), otherwise stay on "new".
  useEffect(() => {
    if (!user) return
    let cancelled = false
    apiFetch<{ addresses: SavedAddress[] }>('/addresses')
      .then((r) => {
        if (cancelled) return
        setAddresses(r.addresses)
        if (r.addresses.length > 0) {
          const def = r.addresses.find((a) => a.isDefault) || r.addresses[0]
          setSelectedId(def.id)
        }
      })
      .catch(() => {
        if (!cancelled) setAddresses([])
      })
    return () => { cancelled = true }
  }, [user])

  // Lazy-load Razorpay Checkout
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.Razorpay) { setScriptReady(true); return }
    const existing = document.querySelector(`script[src="${CHECKOUT_SCRIPT}"]`)
    if (existing) {
      existing.addEventListener('load', () => setScriptReady(true))
      return
    }
    const s = document.createElement('script')
    s.src = CHECKOUT_SCRIPT
    s.async = true
    s.onload = () => setScriptReady(true)
    s.onerror = () => setError('Could not load the payment widget. Please retry.')
    document.head.appendChild(s)
  }, [])

  const cartEmpty = hydrated && items.length === 0 && !success
  useEffect(() => {
    if (cartEmpty) router.replace('/cart')
  }, [cartEmpty, router])

  const selectedAddress: SavedAddress | null = useMemo(() => {
    if (!addresses) return null
    return addresses.find((a) => a.id === selectedId) || null
  }, [addresses, selectedId])

  // Whichever data set we'll actually charge against — the active saved
  // address (if one is selected) or the manual form.
  const activeShipping: ShippingForm = useMemo(() => {
    if (selectedAddress) return shippingFromSaved(selectedAddress, user?.email || form.email)
    return form
  }, [selectedAddress, form, user])

  const validate = useMemo<string | null>(() => {
    const s = activeShipping
    if (!s.fullName.trim()) return 'Please enter your full name'
    if (!/^[+\d][\d\s-]{7,19}$/.test(s.phone.trim())) return 'Please enter a valid phone number'
    if (s.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email.trim())) return 'Please enter a valid email'
    if (!s.line1.trim()) return 'Please enter your address'
    if (!s.city.trim()) return 'Please enter your city'
    if (!s.state.trim()) return 'Please enter your state'
    if (!/^\d{6}$/.test(s.pincode.trim())) return 'Pincode must be exactly 6 digits'
    return null
  }, [activeShipping])

  async function handleDeleteAddress(id: string) {
    if (!confirm('Remove this address from your address book?')) return
    try {
      await apiFetch(`/addresses/${id}`, { method: 'DELETE' })
      setAddresses((prev) => prev?.filter((a) => a.id !== id) || [])
      if (selectedId === id) setSelectedId(NEW_ADDRESS_ID)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove address')
    }
  }

  function startEdit(a: SavedAddress) {
    setEditingId(a.id)
    setEditForm({
      fullName: a.fullName,
      phone: a.phone,
      email: '',
      line1: a.line1,
      line2: a.line2 || '',
      city: a.city,
      state: a.state,
      pincode: a.pincode,
    })
  }

  async function saveEdit() {
    if (!editingId) return
    setError('')
    setEditBusy(true)
    try {
      const r = await apiFetch<{ address: SavedAddress }>(`/addresses/${editingId}`, {
        method: 'PATCH',
        body: {
          fullName: editForm.fullName.trim(),
          phone: editForm.phone.trim(),
          line1: editForm.line1.trim(),
          line2: editForm.line2.trim(),
          city: editForm.city.trim(),
          state: editForm.state.trim(),
          pincode: editForm.pincode.trim(),
        },
      })
      setAddresses((prev) => (prev || []).map((a) => (a.id === editingId ? r.address : a)))
      setEditingId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save address')
    } finally {
      setEditBusy(false)
    }
  }

  async function handlePay() {
    setError('')
    if (validate) { setError(validate); return }
    if (!scriptReady || !window.Razorpay) {
      setError('Payment widget is still loading. Please wait a moment and retry.')
      return
    }
    if (items.length === 0) {
      setError('Your cart is empty.')
      return
    }

    setSubmitting(true)
    try {
      // If the customer chose "new address" and ticked "save for next time",
      // persist it to their address book FIRST so future checkouts get the
      // picker. Failure here is non-fatal — we'd still want to take the
      // payment for the order they're trying to place right now.
      if (selectedId === NEW_ADDRESS_ID && saveNewAddress && user) {
        try {
          const r = await apiFetch<{ address: SavedAddress }>('/addresses', {
            method: 'POST',
            body: {
              fullName: form.fullName.trim(),
              phone: form.phone.trim(),
              line1: form.line1.trim(),
              line2: form.line2.trim(),
              city: form.city.trim(),
              state: form.state.trim(),
              pincode: form.pincode.trim(),
              label: 'Home',
              isDefault: !addresses || addresses.length === 0,
            },
          })
          setAddresses((prev) => [...(prev || []), r.address])
        } catch {
          // intentionally swallowed — see comment above
        }
      }

      const s = activeShipping
      const res = await apiFetch<{
        order: {
          id: string
          razorpayOrderId: string
          amount: number
          displayTotal: number
          currency: string
          customerName: string
          customerEmail: string
          customerPhone: string
        }
        keyId: string
      }>('/razorpay/create-order', {
        method: 'POST',
        body: {
          items: items.map((i) => ({ productId: i.productId, qty: i.quantity })),
          shippingAddress: {
            fullName: s.fullName.trim(),
            phone: s.phone.trim(),
            email: s.email.trim(),
            line1: s.line1.trim(),
            line2: s.line2.trim(),
            city: s.city.trim(),
            state: s.state.trim(),
            pincode: s.pincode.trim(),
          },
          customerName: s.fullName.trim(),
          customerPhone: s.phone.trim(),
          customerEmail: (s.email.trim() || user?.email || '') || undefined,
        },
      })

      if (!res.keyId) {
        setError('Payment gateway is not configured. Please contact support.')
        return
      }

      // Absolute logo URL — Razorpay's iframe needs a fully-qualified https URL.
      // Falls back to the production site if NEXT_PUBLIC_SITE_URL is unset
      // (during local dev the image just won't load, which is fine).
      const siteUrl =
        process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '') ||
        (typeof window !== 'undefined' ? window.location.origin : '')
      const logoUrl = siteUrl ? `${siteUrl}/Logos/logo.jpeg` : undefined

      const rzp = new window.Razorpay({
        key: res.keyId,
        amount: res.order.amount,
        currency: res.order.currency,
        name: 'Srilatha Art',
        description: `Order ${res.order.id}`,
        image: logoUrl,
        order_id: res.order.razorpayOrderId,
        prefill: {
          name: res.order.customerName,
          email: res.order.customerEmail || undefined,
          contact: res.order.customerPhone,
        },
        notes: { internalOrderId: res.order.id },
        theme: { color: '#6D28D9' },
        // Explicitly opt every method in. Razorpay shows a method only when
        // it's both enabled on the merchant account AND not set to false
        // here, so this guarantees nothing is being suppressed client-side.
        method: {
          upi: true,
          card: true,
          netbanking: true,
          wallet: true,
          paylater: true,
          emi: true,
        },
        // Feature UPI prominently at the top of the Checkout sheet (Indian
        // customers expect it as the primary option). `show_default_blocks`
        // keeps Cards / Netbanking / Wallet / Pay Later visible below.
        // If UPI is disabled on the merchant account this block is silently
        // skipped — it never errors out.
        config: {
          display: {
            blocks: {
              upi: {
                name: 'Pay using UPI',
                instruments: [
                  { method: 'upi', flows: ['collect', 'intent', 'qr'] },
                ],
              },
            },
            sequence: ['block.upi'],
            preferences: { show_default_blocks: true },
          },
        },
        // Auto-retry failed attempts inside the same Checkout session.
        retry: { enabled: true, max_count: 3 },
        // 15-minute window. Mirrors Razorpay's recommended default and
        // matches the Razorpay order's natural lifetime.
        timeout: 15 * 60,
        // Lets repeat customers skip re-entering UPI VPA / card number on
        // the same browser (Razorpay-side tokenisation, not ours).
        remember_customer: true,
        send_sms_hash: true,
        modal: {
          escape: true,
          // Prevent accidental close after the user has entered details
          // but before they hit Pay.
          confirm_close: true,
          // Don't dismiss the modal when the backdrop is clicked.
          backdropclose: false,
          ondismiss: () => setSubmitting(false),
        },
        handler: async (rzpRes) => {
          try {
            await apiFetch<{ ok: true; orderId: string }>('/razorpay/verify', {
              method: 'POST',
              body: {
                razorpayOrderId: rzpRes.razorpay_order_id,
                razorpayPaymentId: rzpRes.razorpay_payment_id,
                razorpaySignature: rzpRes.razorpay_signature,
                internalOrderId: res.order.id,
              },
            })
            clear()
            setSuccess({ orderId: res.order.id })
          } catch (verr) {
            const msg = verr instanceof Error ? verr.message : 'We received your payment but could not confirm it. Please contact support.'
            setError(msg)
          } finally {
            setSubmitting(false)
          }
        },
      })

      // Razorpay surfaces granular failure metadata — show what actually
      // went wrong instead of a generic message. Common reasons include:
      //   payment_failed, BAD_REQUEST_ERROR, GATEWAY_ERROR, NETWORK_ERROR
      // and `error.description` is human-readable.
      rzp.on('payment.failed', (resp: unknown) => {
        const f = resp as RazorpayFailureResponse
        const reason = f?.error?.description || f?.error?.reason || 'Payment did not go through.'
        const code = f?.error?.code ? ` (${f.error.code})` : ''
        setError(
          `${reason}${code}. No charge was made — you can retry from the cart.`,
        )
        setSubmitting(false)
        // Also log the full envelope to the console so dev / support can
        // trace via App Insights browser telemetry if needed.
        if (typeof console !== 'undefined') {
          console.warn('[razorpay] payment.failed', f?.error)
        }
      })
      rzp.open()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not start payment. Please try again.'
      setError(msg)
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <main className="min-h-svh max-w-xl mx-auto px-5 py-20 text-center">
        <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
          <ShieldCheck className="w-6 h-6" aria-hidden />
        </div>
        <h1 className="display text-4xl mb-3">
          Thank you - your order is <em className="italic">confirmed</em>
        </h1>
        <p className="text-ink-soft mb-2">Order number</p>
        <p className="font-serif text-2xl mb-8">{success.orderId}</p>
        <p className="text-ink-soft mb-8 text-sm">
          We&apos;ve sent the order details to your email. You can also track it any time from your account.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/account" className="btn-dark">View my orders <ArrowRight className="w-4 h-4" aria-hidden /></Link>
          <Link href="/shop" className="text-sm text-ink-soft hover:text-terracotta self-center">Continue shopping</Link>
        </div>
      </main>
    )
  }

  // While unauthenticated, render the loader — the redirect effect above
  // will move the user to /login on the next tick.
  if (!hydrated || cartEmpty || !user) {
    return (
      <main className="min-h-svh max-w-2xl mx-auto px-5 py-20 text-center">
        <div className="animate-pulse text-ink-mute">Loading…</div>
      </main>
    )
  }

  const hasSaved = (addresses?.length ?? 0) > 0
  const usingNew = selectedId === NEW_ADDRESS_ID

  return (
    <main className="max-w-6xl mx-auto px-5 lg:px-8 py-10 lg:py-16 lg:grid lg:grid-cols-3 lg:gap-12">
      <section className="lg:col-span-2 space-y-8">
        <header>
          <p className="eyebrow mb-3">Checkout</p>
          <h1 className="display text-4xl lg:text-5xl">
            Place your <em className="italic">order</em>
          </h1>
          <p className="text-ink-soft mt-2 text-sm">Pay safely with UPI, debit/credit card or netbanking. Powered by Razorpay.</p>
        </header>

        {/* ── Saved addresses ─────────────────────────────────── */}
        {hasSaved && (
          <div className="card p-6 lg:p-7">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-2xl">Shipping address</h2>
              <p className="text-xs text-ink-mute">{addresses!.length} saved</p>
            </div>

            <ul className="space-y-3">
              {addresses!.map((a) => {
                const checked = selectedId === a.id
                const isEditing = editingId === a.id
                return (
                  <li
                    key={a.id}
                    className={`rounded-2xl border transition-colors ${checked ? 'border-terracotta/60 bg-cream-deep/40' : 'border-ink/10 hover:border-ink/20'
                      }`}
                  >
                    {isEditing ? (
                      <div className="p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Field id={`e-name-${a.id}`} label="Name" required value={editForm.fullName} onChange={(v) => setEditForm({ ...editForm, fullName: v })} />
                          <Field id={`e-phone-${a.id}`} label="Phone" required type="tel" value={editForm.phone} onChange={(v) => setEditForm({ ...editForm, phone: v })} />
                          <div className="sm:col-span-2">
                            <Field id={`e-l1-${a.id}`} label="Address line 1" required value={editForm.line1} onChange={(v) => setEditForm({ ...editForm, line1: v })} />
                          </div>
                          <div className="sm:col-span-2">
                            <Field id={`e-l2-${a.id}`} label="Address line 2" value={editForm.line2} onChange={(v) => setEditForm({ ...editForm, line2: v })} />
                          </div>
                          <Field id={`e-city-${a.id}`} label="City" required value={editForm.city} onChange={(v) => setEditForm({ ...editForm, city: v })} />
                          <Field id={`e-state-${a.id}`} label="State" required value={editForm.state} onChange={(v) => setEditForm({ ...editForm, state: v })} />
                          <Field id={`e-pin-${a.id}`} label="Pincode" required value={editForm.pincode} onChange={(v) => setEditForm({ ...editForm, pincode: v })} inputMode="numeric" maxLength={6} />
                        </div>
                        <div className="flex gap-2 mt-4">
                          <button type="button" onClick={saveEdit} disabled={editBusy} className="btn-dark text-sm h-10 px-4 disabled:opacity-60">
                            <Check className="w-4 h-4" aria-hidden /> {editBusy ? 'Saving…' : 'Save changes'}
                          </button>
                          <button type="button" onClick={() => setEditingId(null)} className="text-sm h-10 px-4 rounded-full border border-ink/15 text-ink hover:bg-cream-deep">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="flex items-start gap-3 p-4 cursor-pointer">
                        <input
                          type="radio"
                          name="address"
                          value={a.id}
                          checked={checked}
                          onChange={() => setSelectedId(a.id)}
                          className="mt-1 accent-terracotta"
                          aria-label={`Use the ${a.label} address`}
                        />
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
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); startEdit(a) }}
                            aria-label="Edit address"
                            className="p-2 text-ink-mute hover:text-terracotta"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); handleDeleteAddress(a.id) }}
                            aria-label="Remove address"
                            className="p-2 text-ink-mute hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </label>
                    )}
                  </li>
                )
              })}

              {/* "Use a new address" radio */}
              <li
                className={`rounded-2xl border transition-colors ${usingNew ? 'border-terracotta/60 bg-cream-deep/40' : 'border-ink/10 hover:border-ink/20'
                  }`}
              >
                <label className="flex items-start gap-3 p-4 cursor-pointer">
                  <input
                    type="radio"
                    name="address"
                    value={NEW_ADDRESS_ID}
                    checked={usingNew}
                    onChange={() => setSelectedId(NEW_ADDRESS_ID)}
                    className="mt-1 accent-terracotta"
                  />
                  <div className="flex items-center gap-2 text-ink">
                    <Plus className="w-4 h-4" aria-hidden />
                    <span className="font-medium">Use a different address</span>
                  </div>
                </label>
              </li>
            </ul>
          </div>
        )}

        {/* ── New / first-time address form ───────────────────── */}
        {(usingNew || !hasSaved) && (
          <div className="card p-6 lg:p-7">
            <h2 className="font-serif text-2xl mb-1">
              {hasSaved ? 'New shipping address' : 'Shipping address'}
            </h2>
            <p className="text-xs text-ink-mute mb-5">
              {hasSaved
                ? 'Enter the address you want this order shipped to.'
                : 'Where should we send your order? We’ll save it for next time.'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field id="fullName" label="Full name" required value={form.fullName} onChange={(v) => setForm({ ...form, fullName: v })} autoComplete="name" />
              <Field id="phone" label="Phone" required value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} autoComplete="tel" type="tel" placeholder="+91 98765 43210" />
              <div className="sm:col-span-2">
                <Field id="email" label="Email (optional but recommended)" value={form.email} onChange={(v) => setForm({ ...form, email: v })} autoComplete="email" type="email" />
              </div>
              <div className="sm:col-span-2">
                <Field id="line1" label="Address line 1" required value={form.line1} onChange={(v) => setForm({ ...form, line1: v })} autoComplete="address-line1" />
              </div>
              <div className="sm:col-span-2">
                <Field id="line2" label="Address line 2 (optional)" value={form.line2} onChange={(v) => setForm({ ...form, line2: v })} autoComplete="address-line2" />
              </div>
              <Field id="city" label="City" required value={form.city} onChange={(v) => setForm({ ...form, city: v })} autoComplete="address-level2" />
              <Field id="state" label="State" required value={form.state} onChange={(v) => setForm({ ...form, state: v })} autoComplete="address-level1" />
              <Field id="pincode" label="Pincode" required value={form.pincode} onChange={(v) => setForm({ ...form, pincode: v })} autoComplete="postal-code" inputMode="numeric" maxLength={6} />
            </div>

            <label className="mt-5 flex items-center gap-2 text-sm text-ink-soft cursor-pointer">
              <input
                type="checkbox"
                checked={saveNewAddress}
                onChange={(e) => setSaveNewAddress(e.target.checked)}
                className="accent-terracotta"
              />
              Save this address to my account
            </label>
          </div>
        )}

        <div className="flex items-center gap-3 text-xs text-ink-soft">
          <ShieldCheck className="w-4 h-4 text-emerald-600" aria-hidden />
          Your payment is safe with Razorpay. We never see your card or UPI details.
        </div>
      </section>

      {/* ── Order summary + Pay button ────────────────────────── */}
      <aside className="lg:col-span-1 mt-10 lg:mt-0">
        <div className="lg:sticky lg:top-32 card p-6 lg:p-7">
          <h2 className="font-serif text-2xl mb-5">Your order</h2>
          <ul className="divide-y divide-ink/10 -mt-2">
            {items.map((item) => (
              <li key={item.productId} className="flex gap-3 py-3">
                <div className="relative shrink-0 w-14 h-14 rounded-xl overflow-hidden bg-cream-deep">
                  <Image src={item.image} alt={item.title} fill sizes="56px" className="object-contain p-1" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink truncate">{item.title}</p>
                  <p className="text-xs text-ink-mute">Qty {item.quantity}</p>
                </div>
                <p className="text-sm font-semibold text-ink tabular-nums">{formatINR(item.price * item.quantity)}</p>
              </li>
            ))}
          </ul>

          <dl className="mt-5 space-y-2.5 text-sm border-t border-ink/10 pt-5 tabular-nums">
            <Row label="Subtotal" value={formatINR(subtotal)} />
            <div className="flex justify-between text-ink-soft">
              <dt>Shipping</dt>
              <dd className="text-ink flex items-baseline gap-2">
                {shipping === 0 ? (
                  <span className="text-emerald-600 font-semibold">Free</span>
                ) : adminShippingDiscountActive ? (
                  <>
                    <span className="text-ink-mute line-through">{formatINR(shippingBaseRs)}</span>
                    <span className="text-emerald-600 font-semibold">{formatINR(shipping)}</span>
                  </>
                ) : (
                  <span>{formatINR(shipping)}</span>
                )}
              </dd>
            </div>
            {adminShippingDiscountActive && shippingDiscountLabel && (
              <p className="-mt-1 text-xs text-emerald-700">
                {shippingDiscountLabel}
              </p>
            )}
            <div className="flex justify-between pt-3 mt-3 border-t border-ink/10 font-semibold text-base">
              <dt>Total</dt>
              <dd className="font-serif text-xl">{formatINR(total)}</dd>
            </div>
          </dl>

          {error && (
            <p role="alert" className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            onClick={handlePay}
            disabled={submitting || items.length === 0}
            className="btn-dark w-full justify-center mt-6 disabled:opacity-60"
          >
            <Lock className="w-4 h-4" aria-hidden />
            {submitting ? 'Opening Razorpay…' : `Pay ${formatINR(total)}`}
          </button>

          <p className="text-xs text-ink-mute mt-4 flex items-center gap-2">
            <Truck className="w-3.5 h-3.5" aria-hidden />
            Free shipping above {formatINR(freeThresholdRs)} · Pan-India.
          </p>
        </div>
      </aside>
    </main>
  )
}

function Field(props: {
  id: string
  label: string
  required?: boolean
  value: string
  onChange: (v: string) => void
  autoComplete?: string
  type?: string
  placeholder?: string
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
        autoComplete={props.autoComplete}
        placeholder={props.placeholder}
        inputMode={props.inputMode}
        maxLength={props.maxLength}
        className="w-full h-11 px-4 rounded-xl border border-ink/15 bg-paper text-sm text-ink placeholder:text-ink-mute focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta/50"
      />
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-ink-soft">
      <dt>{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  )
}

// Silence unused-import warning if XIcon ends up only referenced in jsdoc.
void XIcon
