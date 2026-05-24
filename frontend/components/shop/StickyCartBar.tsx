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
  }

  const onBuyNow = () => {
    if (!addToCart(product, qty)) return
    haptic(20)
    router.push('/checkout')
  }

  return (
    <div
      className="fixed bottom-16 lg:bottom-0 inset-x-0 z-40 safe-pb border-t border-purple-200/50"
      style={{
        background: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
        <div className="hidden sm:block text-purple-950">
          <p className="text-[11px] uppercase tracking-[0.22em] font-bold text-purple-900">Total</p>
          <p className="font-serif text-xl font-bold leading-none tabular-nums">{formatINR(product.price * qty)}</p>
        </div>

        <div className="flex items-center h-11 overflow-hidden shrink-0 bg-white/60 border border-purple-200"
             style={{ borderRadius: '24px' }}
        >
          <button
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            aria-label="Decrease quantity"
            className="w-11 h-11 flex items-center justify-center text-purple-900 hover:text-pink-500
                       disabled:opacity-40 transition-colors duration-300"
            disabled={qty <= 1}
          >
            <Minus className="w-4 h-4" aria-hidden />
          </button>
          <span className="min-w-8 text-center text-purple-950 font-bold" aria-live="polite">
            {qty}
          </span>
          <button
            onClick={() => setQty((q) => Math.min(product.stockQty || 10, q + 1))}
            aria-label="Increase quantity"
            className="w-11 h-11 flex items-center justify-center text-purple-900 hover:text-pink-500
                       transition-colors duration-300"
          >
            <Plus className="w-4 h-4" aria-hidden />
          </button>
        </div>

        <button
          onClick={onAdd}
          disabled={!product.inStock}
          className="btn-outline flex-1 sm:flex-none border-purple-200 text-purple-950 hover:bg-purple-100 disabled:opacity-40 min-h-11 h-11"
        >
          <ShoppingBag className="w-4 h-4" aria-hidden />
          <span className="hidden sm:inline">Add to cart</span>
          <span className="sm:hidden">Add</span>
        </button>
        <button
          onClick={onBuyNow}
          disabled={!product.inStock}
          className="btn-dark flex-[1.4] min-h-11 h-11 disabled:opacity-40"
        >
          {product.inStock ? 'Buy now' : 'Sold out'}
        </button>
      </div>
    </div>
  )
}
