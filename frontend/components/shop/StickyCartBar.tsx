'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Minus, Plus, ShoppingBag } from 'lucide-react'
import type { Product } from '@/types'
import { useAddToCart } from '@/hooks/useAddToCart'
import { useHaptic } from '@/hooks/useHaptic'
import { formatINR } from '@/lib/format'
import { waLink } from '@/lib/site-config'

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

  // Initialised with just the title so the link works during SSR / before
  // hydration; once mounted we enrich with the canonical product URL so
  // Srilatha gets a clickable link in the WhatsApp thread.
  const [waHref, setWaHref] = useState(() =>
    waLink(`Hi Srilatha Art, I'd like to ask about "${product.title}"`),
  )
  useEffect(() => {
    setWaHref(
      waLink(
        `Hi Srilatha Art, I'd like to ask about "${product.title}"\n${window.location.href}`,
      ),
    )
  }, [product.title])

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-40 safe-pb"
      style={{
        background: 'rgba(7, 8, 10, 0.85)',
        backdropFilter: 'blur(16px) saturate(160%)',
        WebkitBackdropFilter: 'blur(16px) saturate(160%)',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
      }}
    >
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-2 sm:gap-3">

        {/* Total */}
        <div className="shrink-0" style={{ color: 'var(--text-primary)' }}>
          <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.22em] leading-none mb-1" style={{ color: 'var(--text-muted)' }}>Total</p>
          <p className="font-serif text-sm sm:text-xl font-semibold leading-none tabular-nums">
            {formatINR(product.price * qty)}
          </p>
        </div>

        {/* Qty stepper */}
        <div
          className="flex items-center h-10 sm:h-11 shrink-0"
          style={{ borderRadius: '24px', border: '1px solid rgba(255,255,255,0.10)' }}
        >
          <button
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            aria-label="Decrease quantity"
            className="w-8 sm:w-11 h-full flex items-center justify-center disabled:opacity-40 transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            disabled={qty <= 1}
          >
            <Minus className="w-3 h-3 sm:w-4 sm:h-4" aria-hidden />
          </button>
          <span className="min-w-5 sm:min-w-8 text-center font-medium text-sm" aria-live="polite" style={{ color: 'var(--text-primary)' }}>
            {qty}
          </span>
          <button
            onClick={() => setQty((q) => Math.min(product.stockQty || 10, q + 1))}
            aria-label="Increase quantity"
            className="w-8 sm:w-11 h-full flex items-center justify-center transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Plus className="w-3 h-3 sm:w-4 sm:h-4" aria-hidden />
          </button>
        </div>

        {/* Add to cart — outlined secondary */}
        <button
          onClick={onAdd}
          disabled={!product.inStock}
          className="flex-1 h-10 sm:h-11 rounded-full inline-flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium disabled:opacity-40 transition-all duration-300 active:scale-[0.98] hover:-translate-y-px"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(148,163,184,0.20)',
            color: 'var(--text-primary)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-blue)'
            e.currentTarget.style.background = 'rgba(59,130,246,0.10)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(148,163,184,0.20)'
            e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
          }}
        >
          <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" aria-hidden />
          <span className="hidden sm:inline">Add to cart</span>
          <span className="sm:hidden">Add</span>
        </button>

        {/* Buy now — primary gold CTA */}
        <button
          onClick={onBuyNow}
          disabled={!product.inStock}
          className="flex-[1.4] h-10 sm:h-11 rounded-full inline-flex items-center justify-center text-xs sm:text-sm font-semibold disabled:opacity-40 transition-all duration-300 active:scale-[0.98] hover:-translate-y-px"
          style={{
            background: 'var(--accent-gold)',
            color: 'var(--ink-dark)',
            boxShadow: 'var(--glow-sm)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--accent-gold-hover)'
            e.currentTarget.style.boxShadow = 'var(--glow-lg)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--accent-gold)'
            e.currentTarget.style.boxShadow = 'var(--glow-sm)'
          }}
        >
          {product.inStock ? 'Buy now' : 'Sold out'}
        </button>

        {/* WhatsApp help - desktop only */}
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat on WhatsApp"
          className="hidden lg:flex items-center gap-2.5 shrink-0 ml-1 group"
        >
          <span className="text-right leading-tight">
            <span className="block text-[10px] transition-colors" style={{ color: 'var(--text-muted)' }}>Need help?</span>
            <span className="block text-[11px] font-medium transition-colors" style={{ color: 'var(--text-secondary)' }}>Chat on WhatsApp</span>
          </span>
          <span
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform"
            style={{ background: '#25D366' }}
          >
            <svg viewBox="0 0 24 24" className="w-4.5 h-4.5 fill-white" aria-hidden>
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </span>
        </a>

      </div>
    </div>
  )
}
