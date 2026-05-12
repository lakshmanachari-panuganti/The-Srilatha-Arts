'use client'
import Link from 'next/link'
import Image from 'next/image'
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react'
import { useCart, cartSubtotal } from '@/stores/cart'
import { formatINR } from '@/lib/format'

const FREE_SHIPPING_THRESHOLD = 2999

export default function CartPage() {
  const items = useCart((s) => s.items)
  const setQty = useCart((s) => s.setQty)
  const remove = useCart((s) => s.remove)

  const subtotal = cartSubtotal(items)
  const shipping = subtotal === 0 ? 0 : subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : 99
  const total = subtotal + shipping
  const toFreeShip = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal)

  if (items.length === 0) {
    return (
      <main className="min-h-svh max-w-2xl mx-auto px-5 py-16 lg:py-24 text-center">
        <ShoppingBag className="w-12 h-12 text-gold/50 mx-auto mb-4" aria-hidden />
        <h1 className="font-serif text-3xl md:text-4xl text-cream mb-3">
          Your bag is <span className="gold-text">waiting</span>
        </h1>
        <p className="text-cream/65 mb-7">
          Nothing here yet. Browse the collection and pick a piece that calls to you.
        </p>
        <Link href="/shop" className="btn-gold">
          Browse the shop
          <ArrowRight className="w-4 h-4" aria-hidden />
        </Link>
      </main>
    )
  }

  return (
    <main className="max-w-7xl mx-auto px-5 lg:px-8 py-6 lg:py-12 lg:grid lg:grid-cols-3 lg:gap-10">
      <div className="lg:col-span-2">
        <h1 className="font-serif text-3xl lg:text-4xl text-cream mb-1">Your bag</h1>
        <p className="text-cream/55 text-sm mb-6">
          {items.length} {items.length === 1 ? 'piece' : 'pieces'}
        </p>

        <ul className="divide-y divide-gold/10">
          {items.map((item) => (
            <li key={item.productId} className="flex gap-4 py-5">
              <Link
                href={`/product/${item.productId}`}
                className="relative shrink-0 w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden bg-cream/5 border border-gold/10"
              >
                <Image
                  src={item.image}
                  alt={item.title}
                  fill
                  sizes="112px"
                  className="object-cover"
                />
              </Link>
              <div className="flex-1 min-w-0">
                <Link href={`/product/${item.productId}`}>
                  <h3 className="font-serif text-base lg:text-lg text-cream leading-tight line-clamp-2 mb-1">
                    {item.title}
                  </h3>
                </Link>
                <p className="text-xs text-cream/55 capitalize">
                  {item.category.replace('-', ' ')} · {item.size}
                </p>
                <div className="flex items-center justify-between mt-3 gap-2">
                  <div className="flex items-center h-10 rounded-full border border-gold/20">
                    <button
                      onClick={() => setQty(item.productId, item.quantity - 1)}
                      aria-label="Decrease quantity"
                      className="w-10 h-10 flex items-center justify-center text-cream/80 hover:text-gold"
                    >
                      <Minus className="w-3.5 h-3.5" aria-hidden />
                    </button>
                    <span className="min-w-7 text-center text-cream text-sm font-medium">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => setQty(item.productId, item.quantity + 1)}
                      aria-label="Increase quantity"
                      className="w-10 h-10 flex items-center justify-center text-cream/80 hover:text-gold"
                    >
                      <Plus className="w-3.5 h-3.5" aria-hidden />
                    </button>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-cream">
                      {formatINR(item.price * item.quantity)}
                    </p>
                    <button
                      onClick={() => remove(item.productId)}
                      className="text-xs text-cream/50 hover:text-primary-burnt inline-flex items-center gap-1 mt-1"
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

      {/* Order summary */}
      <aside className="lg:col-span-1 mt-8 lg:mt-0">
        <div className="lg:sticky lg:top-28 card-glass p-5 lg:p-6">
          <h2 className="font-serif text-xl text-cream mb-4">Order summary</h2>

          {toFreeShip > 0 && (
            <div className="bg-gold/10 border border-gold/20 rounded-xl p-3 mb-4 text-sm text-cream">
              Add <strong>{formatINR(toFreeShip)}</strong> more for free shipping.
              <div className="h-1 rounded-full bg-cream/10 mt-2 overflow-hidden">
                <div
                  className="h-full bg-gold transition-all"
                  style={{
                    width: `${Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          <dl className="space-y-2 text-sm">
            <div className="flex justify-between text-cream/80">
              <dt>Subtotal</dt>
              <dd>{formatINR(subtotal)}</dd>
            </div>
            <div className="flex justify-between text-cream/80">
              <dt>Shipping</dt>
              <dd>{shipping === 0 ? 'Free' : formatINR(shipping)}</dd>
            </div>
            <div className="flex justify-between text-cream pt-2 mt-2 border-t border-gold/10 font-medium text-base">
              <dt>Total</dt>
              <dd className="font-serif text-lg">{formatINR(total)}</dd>
            </div>
          </dl>

          <Link href="/checkout" className="btn-gold w-full justify-center mt-5">
            Checkout
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
          <Link
            href="/shop"
            className="block text-center text-sm text-cream/55 hover:text-gold mt-3"
          >
            Continue shopping
          </Link>
        </div>
      </aside>
    </main>
  )
}
