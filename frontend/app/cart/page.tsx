'use client'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, Tag, X, CheckCircle2 } from 'lucide-react'
import { useCart, cartSubtotal } from '@/stores/cart'
import { formatINR } from '@/lib/format'
import { apiFetch } from '@/lib/api'

const FREE_SHIPPING_THRESHOLD = 2999

interface CouponResult {
  valid: true
  code: string
  displayDiscount: number
  appliedTo: 'cart' | 'shipping'
  message: string
}

export default function CartPage() {
  const items = useCart((s) => s.items)
  const setQty = useCart((s) => s.setQty)
  const remove = useCart((s) => s.remove)

  const [couponInput, setCouponInput] = useState('')
  const [couponResult, setCouponResult] = useState<CouponResult | null>(null)
  const [couponError, setCouponError] = useState('')
  const [couponLoading, setCouponLoading] = useState(false)

  const subtotal = cartSubtotal(items)
  const discount = couponResult?.appliedTo === 'cart' ? couponResult.displayDiscount : 0
  const baseShipping = subtotal === 0 ? 0 : subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : 99
  const shippingDiscount = couponResult?.appliedTo === 'shipping' ? Math.min(couponResult.displayDiscount, baseShipping) : 0
  const shipping = Math.max(0, baseShipping - shippingDiscount)
  const total = Math.max(0, subtotal - discount) + shipping
  const toFreeShip = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal)

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
        <ShoppingBag className="w-12 h-12 text-terracotta/60 mx-auto mb-4" aria-hidden />
        <p className="eyebrow justify-center mb-3">Empty cart</p>
        <h1 className="display text-4xl md:text-5xl mb-4">
          Your cart is <em className="italic">waiting</em>
        </h1>
        <p className="text-ink-soft mb-8">
          Nothing here yet. Browse the collection and pick a piece that calls to you.
        </p>
        <Link href="/shop" className="btn-dark">
          Browse the shop
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
                    <span className="min-w-7 text-center text-ink text-sm font-medium">
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
                    <p className="font-medium text-ink">
                      {formatINR(item.price * item.quantity)}
                    </p>
                    <button
                      onClick={() => remove(item.productId)}
                      className="text-xs text-ink-mute hover:text-terracotta inline-flex items-center gap-1 mt-1"
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
              Add <strong>{formatINR(toFreeShip)}</strong> more for free shipping.
              <div className="h-1 rounded-full bg-ink/10 mt-2 overflow-hidden">
                <div
                  className="h-full bg-terracotta transition-all"
                  style={{
                    width: `${Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          <dl className="space-y-2.5 text-sm">
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
              <dd className="text-ink">
                {shipping === 0 ? (shippingDiscount > 0 ? <span className="text-emerald-600">Free (coupon)</span> : 'Free') : formatINR(shipping)}
              </dd>
            </div>
            <div className="flex justify-between text-ink pt-3 mt-3 border-t border-ink/10 font-medium text-base">
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
                      className="w-full pl-8 pr-3 h-10 rounded-full border border-ink/15 bg-paper text-sm text-ink placeholder:text-ink-mute focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta/50"
                    />
                  </div>
                  <button
                    onClick={applyCoupon}
                    disabled={couponLoading || !couponInput.trim()}
                    className="h-10 px-4 rounded-full bg-terracotta text-white text-sm font-medium disabled:opacity-50 hover:bg-terracotta/90 transition-colors whitespace-nowrap"
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

          <Link href="/checkout" className="btn-dark w-full justify-center mt-6">
            Checkout
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
          <Link
            href="/shop"
            className="block text-center text-sm text-ink-mute hover:text-terracotta mt-3"
          >
            Continue shopping
          </Link>
        </div>
      </aside>
    </main>
  )
}
