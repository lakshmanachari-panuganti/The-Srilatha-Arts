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
  const user = useUserAuth((s) => s.user)

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
      <main className="min-h-svh max-w-2xl mx-auto px-5 py-20 lg:py-28 text-center flex flex-col justify-center">
        <ShoppingBag className="w-16 h-16 text-pink-500 mx-auto mb-6 animate-pulse" aria-hidden />
        <p className="eyebrow justify-center mb-3">Your cart</p>
        <h1 className="display text-4xl md:text-5xl mb-4 text-purple-950 font-bold">
          Your cart is <em className="italic">empty</em>
        </h1>
        <p className="text-purple-900 font-medium mb-8">
          Nothing here yet. Have a look at our shop and add a piece you love.
        </p>
        <Link href="/shop" className="btn-dark mx-auto">
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
        <h1 className="display text-4xl lg:text-5xl mb-2 text-purple-950 font-bold">
          {items.length} {items.length === 1 ? 'piece' : 'pieces'}
        </h1>

        <ul className="divide-y divide-purple-200 mt-8">
          {items.map((item) => (
            <li key={item.productId} className="flex gap-4 py-6">
              <Link
                href={`/product/${item.productId}`}
                className="relative shrink-0 w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-purple-100/30 border border-purple-200"
              >
                <Image
                  src={item.image || '/images/logo.png'}
                  alt={item.title}
                  fill
                  sizes="112px"
                  className="object-contain p-3"
                />
              </Link>
              <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div>
                  <Link href={`/product/${item.productId}`}>
                    <h3 className="font-serif text-base lg:text-lg text-purple-950 font-bold leading-snug line-clamp-2 mb-1 hover:text-pink-500 transition-colors duration-300">
                      {item.title}
                    </h3>
                  </Link>
                  <p className="text-xs font-bold text-purple-900/60 uppercase tracking-wider capitalize">
                    {item.category.replace('-', ' ')} · {item.size}
                  </p>
                </div>
                <div className="flex items-center justify-between mt-3 gap-2">
                  <div className="flex items-center h-10 rounded-full border border-purple-200 bg-white/60">
                    <button
                      onClick={() => setQty(item.productId, item.quantity - 1)}
                      aria-label="Decrease quantity"
                      className="w-10 h-10 flex items-center justify-center text-purple-900 hover:text-pink-500"
                    >
                      <Minus className="w-3.5 h-3.5" aria-hidden />
                    </button>
                    <span className="min-w-7 text-center text-purple-950 font-bold text-sm tabular-nums">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => setQty(item.productId, item.quantity + 1)}
                      aria-label="Increase quantity"
                      className="w-10 h-10 flex items-center justify-center text-purple-900 hover:text-pink-500"
                    >
                      <Plus className="w-3.5 h-3.5" aria-hidden />
                    </button>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-purple-950 tabular-nums">
                      {formatINR(item.price * item.quantity)}
                    </p>
                    <button
                      onClick={() => remove(item.productId)}
                      className="text-xs font-bold text-purple-900/60 hover:text-pink-500 inline-flex items-center gap-1 mt-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden />
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
        <div className="lg:sticky lg:top-32 card p-6 lg:p-7 border border-purple-200 bg-white/70">
          <h2 className="font-serif text-2xl text-purple-950 font-bold mb-5">Summary</h2>

          {toFreeShip > 0 && (
            <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4 mb-5 text-sm font-semibold text-purple-950">
              Add <strong>{formatINR(toFreeShip)}</strong> more to get free shipping.
              <div className="h-1.5 rounded-full bg-purple-200/50 mt-2.5 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-400 transition-all duration-300"
                  style={{
                    width: `${Math.min(100, (subtotal / freeThresholdRs) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          <dl className="space-y-3.5 text-sm font-medium tabular-nums">
            <div className="flex justify-between text-purple-900/80">
              <dt>Subtotal</dt>
              <dd className="text-purple-950 font-bold">{formatINR(subtotal)}</dd>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-emerald-600 font-bold">
                <dt>Coupon ({couponResult!.code})</dt>
                <dd>−{formatINR(discount)}</dd>
              </div>
            )}
            <div className="flex justify-between text-purple-900/80">
              <dt>Shipping</dt>
              <dd className="text-purple-950 font-bold flex items-baseline gap-2">
                {shipping === 0 ? (
                  <span className="text-emerald-600 font-bold">
                    {shippingDiscount > 0 ? 'Free (coupon)' : 'Free'}
                  </span>
                ) : adminShippingDiscountActive ? (
                  <>
                    <span className="text-purple-900/40 line-through tabular-nums font-medium">
                      {formatINR(shippingBaseRs)}
                    </span>
                    <span className="text-emerald-600 font-bold tabular-nums">
                      {formatINR(shipping)}
                    </span>
                  </>
                ) : (
                  <span className="tabular-nums font-bold">{formatINR(shipping)}</span>
                )}
              </dd>
            </div>
            {adminShippingDiscountActive && shipping > 0 && shippingDiscountLabel && (
              <p className="-mt-1 text-xs text-emerald-700 flex items-center gap-1.5 font-bold">
                <BadgePercent className="w-3.5 h-3.5" aria-hidden />
                {shippingDiscountLabel}
              </p>
            )}
            <div className="flex justify-between text-purple-950 pt-4 mt-4 border-t border-purple-200 font-black text-base">
              <dt>Total</dt>
              <dd className="font-serif text-xl text-purple-950">{formatINR(total)}</dd>
            </div>
          </dl>

          {/* Coupon input */}
          <div className="mt-5 border-t border-purple-200 pt-5">
            {couponResult ? (
              <div className="flex items-center justify-between rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm">
                <span className="flex items-center gap-2 text-emerald-700 font-bold">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" aria-hidden />
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
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-900/50" aria-hidden />
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError('') }}
                      onKeyDown={(e) => e.key === 'Enter' && applyCoupon()}
                      placeholder="Coupon code"
                      className="w-full pl-9 pr-3 h-10 rounded-full border border-purple-200 bg-white/80 text-sm font-semibold text-purple-950 placeholder:text-purple-700/50 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                    />
                  </div>
                  <button
                    onClick={applyCoupon}
                    disabled={couponLoading || !couponInput.trim()}
                    className="h-10 px-5 rounded-full bg-pink-500 text-white text-sm font-bold disabled:opacity-50 hover:bg-pink-600 transition-colors whitespace-nowrap shadow-sm active:scale-95"
                  >
                    {couponLoading ? '…' : 'Apply'}
                  </button>
                </div>
                {couponError && (
                  <p className="text-xs text-red-600 px-1 font-semibold">{couponError}</p>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
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
            className="block text-center text-sm font-bold text-purple-900/60 hover:text-pink-500 mt-4 transition-colors duration-300"
          >
            Continue shopping
          </Link>
        </div>
      </aside>
    </main>
  )
}
