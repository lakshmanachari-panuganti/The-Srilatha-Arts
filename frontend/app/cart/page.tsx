'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, Tag, X, CheckCircle2, BadgePercent } from 'lucide-react'
import { useCart, cartSubtotal } from '@/stores/cart'
import { useUserAuth } from '@/stores/userAuth'
import { formatINR } from '@/lib/format'
import { apiFetch } from '@/lib/api'

// Fallback values used until the admin-configurable shipping settings
// have loaded. These match the historical hardcoded defaults so an old
// or offline cart still renders something sensible.
const FALLBACK_BASE_CHARGE_RUPEES = 99
const FALLBACK_THRESHOLD_RUPEES = 2999

interface ShippingConfigApi {
  shipping: {
    baseCharge: number       // paise
    effectiveCharge: number  // paise
    freeThreshold: number    // paise
    discountLabel?: string
  }
}

interface CouponResult {
  valid: true
  code: string
  displayDiscount: number
  appliedTo: 'cart' | 'shipping'
  message: string
}

export default function CartPage() {
  const router = useRouter()
  const items = useCart((s) => s.items)
  const setQty = useCart((s) => s.setQty)
  const remove = useCart((s) => s.remove)
  const refreshPrices = useCart((s) => s.refreshPrices)
  const user = useUserAuth((s) => s.user)

  // Price-freshness check. Cart items are persisted to localStorage on add,
  // so a price update between add-to-cart and cart-page-load goes unnoticed
  // until checkout (where the backend re-prices anyway). Refreshing on
  // cart open + surfacing a notice lets the customer review the new total
  // before they commit, instead of being surprised at payment.
  const [priceChanges, setPriceChanges] = useState<
    { productId: string; title: string; oldPrice: number; newPrice: number }[]
  >([])
  useEffect(() => {
    let cancelled = false
    refreshPrices()
      .then((changes) => {
        if (!cancelled) setPriceChanges(changes)
      })
      .catch(() => { /* offline / 5xx — keep stored prices */ })
    return () => { cancelled = true }
  }, [refreshPrices])

  const [couponInput, setCouponInput] = useState('')
  const [couponResult, setCouponResult] = useState<CouponResult | null>(null)
  const [couponError, setCouponError] = useState('')
  const [couponLoading, setCouponLoading] = useState(false)

  // Admin-configurable shipping settings. Default to the legacy hardcoded
  // values until the API call resolves so first paint doesn't look broken.
  const [shippingBaseRs, setShippingBaseRs] = useState(FALLBACK_BASE_CHARGE_RUPEES)
  const [shippingEffectiveRs, setShippingEffectiveRs] = useState(FALLBACK_BASE_CHARGE_RUPEES)
  const [freeThresholdRs, setFreeThresholdRs] = useState(FALLBACK_THRESHOLD_RUPEES)
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
      .catch(() => { /* keep fallback values */ })
    return () => { cancelled = true }
  }, [])

  const subtotal = cartSubtotal(items)
  const discount = couponResult?.appliedTo === 'cart' ? couponResult.displayDiscount : 0
  // baseShipping = what we'd charge with no coupon, using the admin's current rate.
  const baseShipping =
    subtotal === 0
      ? 0
      : subtotal >= freeThresholdRs
        ? 0
        : shippingEffectiveRs
  const shippingDiscount = couponResult?.appliedTo === 'shipping' ? Math.min(couponResult.displayDiscount, baseShipping) : 0
  const shipping = Math.max(0, baseShipping - shippingDiscount)
  const total = Math.max(0, subtotal - discount) + shipping
  const toFreeShip = Math.max(0, freeThresholdRs - subtotal)
  const adminShippingDiscountActive = shippingEffectiveRs < shippingBaseRs && baseShipping > 0

  const applyCoupon = async () => {
    const code = couponInput.trim().toUpperCase()
    if (!code) return
    setCouponLoading(true)
    setCouponError('')
    try {
      const data = await apiFetch<{ valid: boolean; code?: string; displayDiscount?: number; appliedTo?: string; message: string }>(
        '/coupons/validate',
        {
          method: 'POST',
          body: {
            code,
            items: items.map((i) => ({
              productId: i.productId,
              category: i.category,
              price: Math.round(i.price * 100), // convert rupees → paise
              qty: i.quantity,
            })),
          },
        },
      )
      if (data.valid) {
        setCouponResult({
          valid: true,
          code: data.code!,
          displayDiscount: data.displayDiscount!,
          appliedTo: (data.appliedTo as 'cart' | 'shipping') ?? 'cart',
          message: data.message,
        })
        setCouponInput('')
      } else {
        setCouponError(data.message)
        setCouponResult(null)
      }
    } catch {
      setCouponError('Could not validate coupon. Please try again.')
    } finally {
      setCouponLoading(false)
    }
  }

  const removeCoupon = () => {
    setCouponResult(null)
    setCouponError('')
  }

  if (items.length === 0) {
    return (
      <main className="min-h-svh max-w-2xl mx-auto px-5 py-20 lg:py-28 text-center">
        <ShoppingBag className="w-12 h-12 text-lavender-pastel/60 mx-auto mb-4" aria-hidden />
        <p className="eyebrow justify-center mb-3">Your cart</p>
        <h1 className="display text-4xl md:text-5xl mb-4">
          Your cart is <em className="italic">empty</em>
        </h1>
        <p className="text-ink-soft mb-8">
          Nothing here yet. Have a look at our shop and add a piece you love.
        </p>
        <Link href="/shop" className="btn-dark">
          Start shopping
          <ArrowRight className="w-4 h-4" aria-hidden />
        </Link>
      </main>
    )
  }

  return (
    <main className="max-w-6xl mx-auto px-5 lg:px-8 py-10 lg:py-16 lg:grid lg:grid-cols-3 lg:gap-12">
      <div className="lg:col-span-2">
        <p className="eyebrow mb-3">Your cart</p>
        <h1 className="display text-4xl lg:text-5xl mb-2">
          {items.length} {items.length === 1 ? 'piece' : 'pieces'}
        </h1>

        {priceChanges.length > 0 && (
          <div
            role="status"
            className="mt-6 rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-ink"
          >
            <p className="font-semibold mb-1">Prices were updated</p>
            <ul className="space-y-0.5 text-ink-soft">
              {priceChanges.map((c) => (
                <li key={c.productId}>
                  <span className="text-ink">{c.title}</span> —{' '}
                  <span className="line-through tabular-nums">{formatINR(c.oldPrice)}</span>{' '}
                  <span className="tabular-nums">{formatINR(c.newPrice)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <ul className="divide-y divide-ink/10 mt-8">
          {items.map((item) => (
            <li key={item.productId} className="flex gap-4 py-6">
              <Link
                href={`/product/${item.productId}`}
                className="relative shrink-0 w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-cream-deep"
              >
                <Image
                  src={item.image}
                  alt={item.title}
                  fill
                  sizes="112px"
                  className="object-contain p-3"
                />
              </Link>
              <div className="flex-1 min-w-0">
                <Link href={`/product/${item.productId}`}>
                  <h3 className="font-serif text-base lg:text-lg text-ink leading-snug line-clamp-2 mb-1">
                    {item.title}
                  </h3>
                </Link>
                <p className="text-xs text-ink-mute capitalize">
                  {item.category.replace('-', ' ')} · {item.size}
                </p>
                <div className="flex items-center justify-between mt-3 gap-2">
                  <div className="flex items-center h-10 rounded-full border border-ink/15 bg-paper">
                    <button
                      onClick={() => setQty(item.productId, item.quantity - 1)}
                      aria-label="Decrease quantity"
                      className="w-10 h-10 flex items-center justify-center text-ink-soft hover:text-ink"
                    >
                      <Minus className="w-3.5 h-3.5" aria-hidden />
                    </button>
                    <span className="min-w-7 text-center text-ink text-sm font-semibold tabular-nums">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => setQty(item.productId, item.quantity + 1)}
                      aria-label="Increase quantity"
                      className="w-10 h-10 flex items-center justify-center text-ink-soft hover:text-ink"
                    >
                      <Plus className="w-3.5 h-3.5" aria-hidden />
                    </button>
                  </div>
                  <div className="text-right">
                    {/* Strikethrough "was" price stacks above the current
                        line total when the piece is on sale. Mirrors the
                        product-card treatment so a customer sees the same
                        savings signal end-to-end. */}
                    {item.compareAtPrice && item.compareAtPrice > item.price && (
                      <p className="text-xs text-ink-mute line-through tabular-nums leading-none">
                        {formatINR(item.compareAtPrice * item.quantity)}
                      </p>
                    )}
                    <p className="font-semibold text-ink tabular-nums mt-0.5">
                      {formatINR(item.price * item.quantity)}
                    </p>
                    <button
                      onClick={() => remove(item.productId)}
                      className="text-xs text-ink-mute hover:text-lavender inline-flex items-center gap-1 mt-1"
                    >
                      <Trash2 className="w-3 h-3" aria-hidden />
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <aside className="lg:col-span-1 mt-10 lg:mt-0">
        <div className="lg:sticky lg:top-32 card p-6 lg:p-7">
          <h2 className="font-serif text-2xl text-ink mb-5">Summary</h2>

          {toFreeShip > 0 && (
            <div className="bg-cream-deep rounded-2xl p-4 mb-5 text-sm text-ink">
              Add <strong>{formatINR(toFreeShip)}</strong> more to get free shipping.
              <div className="h-1 rounded-full bg-ink/10 mt-2 overflow-hidden">
                <div
                  className="h-full bg-lavender transition-all"
                  style={{
                    width: `${Math.min(100, (subtotal / freeThresholdRs) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          <dl className="space-y-2.5 text-sm tabular-nums">
            <div className="flex justify-between text-ink-soft">
              <dt>Subtotal</dt>
              <dd className="text-ink">{formatINR(subtotal)}</dd>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <dt>Coupon ({couponResult!.code})</dt>
                <dd>−{formatINR(discount)}</dd>
              </div>
            )}
            <div className="flex justify-between text-ink-soft">
              <dt>Shipping</dt>
              <dd className="text-ink flex items-baseline gap-2">
                {shipping === 0 ? (
                  <span className="text-emerald-600 font-semibold">
                    {shippingDiscount > 0 ? 'Free (coupon)' : 'Free'}
                  </span>
                ) : adminShippingDiscountActive ? (
                  <>
                    <span className="text-ink-mute line-through tabular-nums">
                      {formatINR(shippingBaseRs)}
                    </span>
                    <span className="text-emerald-600 font-semibold tabular-nums">
                      {formatINR(shipping)}
                    </span>
                  </>
                ) : (
                  <span className="tabular-nums">{formatINR(shipping)}</span>
                )}
              </dd>
            </div>
            {adminShippingDiscountActive && shipping > 0 && shippingDiscountLabel && (
              <p className="-mt-1 text-xs text-emerald-700 flex items-center gap-1.5">
                <BadgePercent className="w-3.5 h-3.5" aria-hidden />
                {shippingDiscountLabel}
              </p>
            )}
            <div className="flex justify-between text-ink pt-3 mt-3 border-t border-ink/10 font-semibold text-base">
              <dt>Total</dt>
              <dd className="font-serif text-xl">{formatINR(total)}</dd>
            </div>
          </dl>

          {/* Coupon input */}
          <div className="mt-5 border-t border-ink/10 pt-5">
            {couponResult ? (
              <div className="flex items-center justify-between rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm">
                <span className="flex items-center gap-2 text-emerald-700 font-medium">
                  <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden />
                  {couponResult.message}
                </span>
                <button onClick={removeCoupon} aria-label="Remove coupon" className="text-emerald-500 hover:text-emerald-700 ml-2">
                  <X className="w-4 h-4" aria-hidden />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-mute" aria-hidden />
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError('') }}
                      onKeyDown={(e) => e.key === 'Enter' && applyCoupon()}
                      placeholder="Coupon code"
                      className="w-full pl-8 pr-3 h-10 rounded-full border border-ink/15 bg-paper text-sm text-ink placeholder:text-ink-mute focus:outline-none focus:ring-2 focus:ring-lavender/30 focus:border-lavender/50"
                    />
                  </div>
                  <button
                    onClick={applyCoupon}
                    disabled={couponLoading || !couponInput.trim()}
                    className="h-10 px-4 rounded-full bg-lavender text-white text-sm font-medium disabled:opacity-50 hover:bg-lavender/90 transition-colors whitespace-nowrap"
                  >
                    {couponLoading ? '…' : 'Apply'}
                  </button>
                </div>
                {couponError && (
                  <p className="text-xs text-red-600 px-1">{couponError}</p>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              // Auth gate: keep the cart, send the user through login and
              // bring them straight back to /checkout afterwards.
              if (!user) {
                router.push('/login?next=' + encodeURIComponent('/checkout'))
                return
              }
              router.push('/checkout')
            }}
            className="btn-dark w-full justify-center mt-6"
          >
            {user ? 'Checkout' : 'Sign in to checkout'}
            <ArrowRight className="w-4 h-4" aria-hidden />
          </button>
          <Link
            href="/shop"
            className="block text-center text-sm text-ink-mute hover:text-lavender mt-3"
          >
            Continue shopping
          </Link>

          {/*
            Payment-method strip - answers the "will my UPI work here?"
            question BEFORE the customer commits to checkout. Per the
            buyer-psychology audit, payment-method anxiety is one of the
            top 3 Indian D2C abandonment reasons. A single line of trust
            signals removes that friction in <1 second of scanning.
          */}
          <div className="mt-6 pt-5 border-t border-ink/10 text-center">
            <p className="text-[10px] uppercase tracking-[0.18em] text-ink-mute mb-2">
              We accept
            </p>
            <p className="text-xs text-ink-soft leading-relaxed">
              UPI · GPay · PhonePe · Paytm · Visa · Mastercard · RuPay · COD
            </p>
            <p className="text-[10px] text-ink-mute mt-2 inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" aria-hidden />
              Razorpay-secured checkout · 256-bit SSL
            </p>
          </div>
        </div>
      </aside>
    </main>
  )
}
