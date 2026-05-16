'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ArrowRight, Lock, ShieldCheck, Truck } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useCart, cartSubtotal } from '@/stores/cart'
import { useUserAuth } from '@/stores/userAuth'
import { formatINR } from '@/lib/format'

const FREE_SHIPPING_THRESHOLD = 2999

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
  order_id: string
  prefill?: { name?: string; email?: string; contact?: string }
  theme?: { color?: string }
  notes?: Record<string, string>
  handler: (response: {
    razorpay_payment_id: string
    razorpay_order_id: string
    razorpay_signature: string
  }) => void
  modal?: { ondismiss?: () => void; escape?: boolean }
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

function emptyShipping(): ShippingForm {
  return { fullName: '', phone: '', email: '', line1: '', line2: '', city: '', state: '', pincode: '' }
}

const CHECKOUT_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js'

export default function CheckoutClient() {
  const router = useRouter()
  const items = useCart((s) => s.items)
  const hydrated = useCart((s) => s.hydrated)
  const clear = useCart((s) => s.clear)
  const user = useUserAuth((s) => s.user)

  const [form, setForm] = useState<ShippingForm>(emptyShipping)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [scriptReady, setScriptReady] = useState(false)
  const [success, setSuccess] = useState<{ orderId: string } | null>(null)

  const subtotal = cartSubtotal(items)
  const shipping = subtotal === 0 ? 0 : subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : 99
  const total = subtotal + shipping

  // Pre-fill from logged-in user
  useEffect(() => {
    if (!user) return
    setForm((f) => ({
      ...f,
      fullName: f.fullName || user.name || '',
      email: f.email || user.email || '',
      phone: f.phone || user.phone || '',
    }))
  }, [user])

  // Load Razorpay Checkout script once
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

  // After hydration, an empty cart means there's nothing to check out
  const cartEmpty = hydrated && items.length === 0 && !success
  useEffect(() => {
    if (cartEmpty) router.replace('/cart')
  }, [cartEmpty, router])

  const validate = useMemo<string | null>(() => {
    if (!form.fullName.trim()) return 'Please enter your full name'
    if (!/^[+\d][\d\s-]{7,19}$/.test(form.phone.trim())) return 'Please enter a valid phone number'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Please enter a valid email'
    if (!form.line1.trim()) return 'Please enter your address'
    if (!form.city.trim()) return 'Please enter your city'
    if (!form.state.trim()) return 'Please enter your state'
    if (!/^\d{6}$/.test(form.pincode.trim())) return 'Pincode must be exactly 6 digits'
    return null
  }, [form])

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
      // 1. Server creates internal order + Razorpay order with authoritative pricing.
      const res = await apiFetch<{
        order: {
          id: string
          razorpayOrderId: string
          amount: number          // paise
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
            fullName: form.fullName.trim(),
            phone: form.phone.trim(),
            email: form.email.trim(),
            line1: form.line1.trim(),
            line2: form.line2.trim(),
            city: form.city.trim(),
            state: form.state.trim(),
            pincode: form.pincode.trim(),
          },
          customerName: form.fullName.trim(),
          customerPhone: form.phone.trim(),
          customerEmail: form.email.trim() || undefined,
        },
      })

      if (!res.keyId) {
        setError('Payment gateway is not configured. Please contact support.')
        return
      }

      // 2. Open Razorpay Checkout.
      const rzp = new window.Razorpay({
        key: res.keyId,
        amount: res.order.amount,
        currency: res.order.currency,
        name: 'Srilatha Art',
        description: `Order ${res.order.id}`,
        order_id: res.order.razorpayOrderId,
        prefill: {
          name: res.order.customerName,
          email: res.order.customerEmail || undefined,
          contact: res.order.customerPhone,
        },
        notes: { internalOrderId: res.order.id },
        theme: { color: '#6D28D9' },
        modal: {
          escape: true,
          ondismiss: () => setSubmitting(false),
        },
        handler: async (rzpRes) => {
          // 3. Verify the signature server-side before considering paid.
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
      rzp.on('payment.failed', () => {
        setError('Payment failed. You can retry from the cart — no charge was made.')
        setSubmitting(false)
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
          Thank you, <em className="italic">your order is confirmed</em>
        </h1>
        <p className="text-ink-soft mb-2">Order reference</p>
        <p className="font-serif text-2xl mb-8">{success.orderId}</p>
        <p className="text-ink-soft mb-8 text-sm">
          We&apos;ve sent a confirmation to your email. You can track this order from your account.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/account" className="btn-dark">My orders <ArrowRight className="w-4 h-4" aria-hidden /></Link>
          <Link href="/shop" className="text-sm text-ink-soft hover:text-terracotta self-center">Keep browsing</Link>
        </div>
      </main>
    )
  }

  if (!hydrated || cartEmpty) {
    return (
      <main className="min-h-svh max-w-2xl mx-auto px-5 py-20 text-center">
        <div className="animate-pulse text-ink-mute">Loading…</div>
      </main>
    )
  }

  return (
    <main className="max-w-6xl mx-auto px-5 lg:px-8 py-10 lg:py-16 lg:grid lg:grid-cols-3 lg:gap-12">
      <section className="lg:col-span-2 space-y-8">
        <header>
          <p className="eyebrow mb-3">Checkout</p>
          <h1 className="display text-4xl lg:text-5xl">
            Almost <em className="italic">yours</em>
          </h1>
          <p className="text-ink-soft mt-2 text-sm">Pay securely with UPI, cards, or netbanking via Razorpay.</p>
        </header>

        <div className="card p-6 lg:p-7">
          <h2 className="font-serif text-2xl mb-5">Shipping details</h2>
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
        </div>

        <div className="flex items-center gap-3 text-xs text-ink-soft">
          <ShieldCheck className="w-4 h-4 text-emerald-600" aria-hidden />
          Your payment is encrypted and processed by Razorpay. We never see your card details.
        </div>
      </section>

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
                <p className="text-sm text-ink">{formatINR(item.price * item.quantity)}</p>
              </li>
            ))}
          </ul>

          <dl className="mt-5 space-y-2.5 text-sm border-t border-ink/10 pt-5">
            <Row label="Subtotal" value={formatINR(subtotal)} />
            <Row label="Shipping" value={shipping === 0 ? 'Free' : formatINR(shipping)} />
            <div className="flex justify-between pt-3 mt-3 border-t border-ink/10 font-medium text-base">
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
            Free shipping above {formatINR(FREE_SHIPPING_THRESHOLD)} · Pan-India.
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
