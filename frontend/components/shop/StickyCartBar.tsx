'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Minus, Plus, ShoppingBag } from 'lucide-react'
import type { Product } from '@/types'
import { useAddToCart } from '@/hooks/useAddToCart'
import { useHaptic } from '@/hooks/useHaptic'
import { formatINR } from '@/lib/format'

export default function StickyCartBar({ product }: { product: Product }) {
  const [qty, setQty] = useState(1)
  const { addToCart } = useAddToCart()
  const haptic = useHaptic()
  const router = useRouter()

  const onAdd = () => {
    if (addToCart(product, qty)) haptic([10, 25, 10])
    // false → useAddToCart already redirected to /login
  }

  const onBuyNow = () => {
    // If unauthenticated, addToCart redirects to /login?next=… and returns
    // false; the post-login redirect lands the user back on this product
    // page where they can hit "Buy now" again. We do NOT also push to
    // /checkout in that case (would clobber the login redirect).
    if (!addToCart(product, qty)) return
    haptic(20)
    router.push('/checkout')
  }

  return (
    <div
      className="fixed bottom-16 lg:bottom-0 inset-x-0 z-40 safe-pb"
      style={{
        background: 'rgba(76,29,149,0.92)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
        <div className="hidden sm:block text-plum">
          <p className="text-11 uppercase tracking-[0.22em] text-plum-warm">Total</p>
          <p className="font-serif text-xl font-semibold leading-none tabular-nums">{formatINR(product.price * qty)}</p>
        </div>

        <div className="flex items-center h-11 overflow-hidden shrink-0"
             style={{ borderRadius: '24px', border: '1px solid rgba(255,255,255,0.12)' }}
        >
          <button
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            aria-label="Decrease quantity"
            className="w-11 h-11 flex items-center justify-center text-plum-warm hover:text-plum
                       disabled:opacity-40 transition-colors duration-500"
            disabled={qty <= 1}
          >
            <Minus className="w-4 h-4" aria-hidden />
          </button>
          <span className="min-w-8 text-center text-plum font-medium" aria-live="polite">
            {qty}
          </span>
          <button
            onClick={() => setQty((q) => Math.min(product.stockQty || 10, q + 1))}
            aria-label="Increase quantity"
            className="w-11 h-11 flex items-center justify-center text-ivory-mute hover:text-ivory
                       transition-colors duration-500"
          >
            <Plus className="w-4 h-4" aria-hidden />
          </button>
        </div>

        <button
          onClick={onAdd}
          disabled={!product.inStock}
          className="btn-outline flex-1 sm:flex-none disabled:opacity-40"
        >
          <ShoppingBag className="w-4 h-4" aria-hidden />
          <span className="hidden sm:inline">Add to cart</span>
          <span className="sm:hidden">Add</span>
        </button>
        <button
          onClick={onBuyNow}
          disabled={!product.inStock}
          className="btn-dark flex-[1.4] disabled:opacity-40"
        >
          {product.inStock ? 'Buy now' : 'Sold out'}
        </button>
      </div>
    </div>
  )
}
