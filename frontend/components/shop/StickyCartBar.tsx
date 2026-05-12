'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Minus, Plus, ShoppingBag } from 'lucide-react'
import type { Product } from '@/types'
import { useCart } from '@/stores/cart'
import { useHaptic } from '@/hooks/useHaptic'
import { formatINR } from '@/lib/format'

export default function StickyCartBar({ product }: { product: Product }) {
  const [qty, setQty] = useState(1)
  const add = useCart((s) => s.add)
  const haptic = useHaptic()
  const router = useRouter()

  const onAdd = () => {
    add(product, qty)
    haptic([10, 25, 10])
  }

  const onBuyNow = () => {
    add(product, qty)
    haptic(20)
    router.push('/checkout')
  }

  return (
    <div
      className="fixed bottom-16 lg:bottom-0 inset-x-0 z-40
                 bg-primary-dark/95 backdrop-blur-xl border-t border-gold/15 safe-pb"
    >
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
        <div className="hidden sm:block text-cream">
          <p className="text-xs text-cream/55">Total</p>
          <p className="font-serif text-lg leading-none">{formatINR(product.price * qty)}</p>
        </div>

        <div className="flex items-center h-11 rounded-full border border-gold/20 overflow-hidden shrink-0">
          <button
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            aria-label="Decrease quantity"
            className="w-11 h-11 flex items-center justify-center text-cream/80 hover:text-gold active:bg-gold/10 disabled:opacity-40"
            disabled={qty <= 1}
          >
            <Minus className="w-4 h-4" aria-hidden />
          </button>
          <span className="min-w-8 text-center text-cream font-medium" aria-live="polite">
            {qty}
          </span>
          <button
            onClick={() => setQty((q) => Math.min(product.stockQty || 10, q + 1))}
            aria-label="Increase quantity"
            className="w-11 h-11 flex items-center justify-center text-cream/80 hover:text-gold active:bg-gold/10"
          >
            <Plus className="w-4 h-4" aria-hidden />
          </button>
        </div>

        <button
          onClick={onAdd}
          disabled={!product.inStock}
          className="btn-outline flex-1 sm:flex-none border-gold/40 text-gold disabled:opacity-40"
        >
          <ShoppingBag className="w-4 h-4" aria-hidden />
          <span className="hidden sm:inline">Add to bag</span>
          <span className="sm:hidden">Add</span>
        </button>
        <button
          onClick={onBuyNow}
          disabled={!product.inStock}
          className="btn-gold flex-[1.4] disabled:opacity-40"
        >
          {product.inStock ? 'Buy now' : 'Sold out'}
        </button>
      </div>
    </div>
  )
}
