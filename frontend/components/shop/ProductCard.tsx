'use client'
import Link from 'next/link'
import Image from 'next/image'
import { Heart, Plus } from 'lucide-react'
import type { Product } from '@/types'
import { formatINR, discountPct } from '@/lib/format'
import { useWishlist } from '@/stores/wishlist'
import { useAddToCart } from '@/hooks/useAddToCart'
import { useHaptic } from '@/hooks/useHaptic'
import { cn } from '@/lib/cn'

interface Props {
  product: Product
  variant?: 'grid' | 'carousel'
  priority?: boolean
}

export default function ProductCard({ product, variant = 'grid', priority = false }: Props) {
  const { addToCart } = useAddToCart()
  const toggleWishlist = useWishlist((s) => s.toggle)
  const inWishlist = useWishlist((s) => s.has(product.id))
  const haptic = useHaptic()

  const pct = discountPct(product.price, product.compareAtPrice)

  const onAdd = (e: React.MouseEvent) => {
    e.preventDefault()
    // useAddToCart returns false if it redirected to login — no haptic
    // in that case (the page is unmounting anyway).
    if (addToCart(product)) haptic([12, 30, 12])
  }

  const onWish = (e: React.MouseEvent) => {
    e.preventDefault()
    toggleWishlist(product)
    haptic(10)
  }

  return (
    <article
      className={cn(
        'group relative',
        variant === 'carousel' ? 'w-[68vw] sm:w-72 shrink-0 snap-start' : '',
      )}
    >
      <Link href={`/product/${product.id}`} className="block">
        <div className="relative aspect-[4/5] overflow-hidden
                        bg-gradient-to-b from-lavender-light to-white
                        border border-glass-border
                        transition-all duration-700
                        group-hover:border-lavender-pastel/30
                        group-hover:shadow-editorial"
             style={{ borderRadius: '24px' }}
        >
          <Image
            src={product.images[0]}
            alt={product.title}
            fill
            sizes={
              variant === 'carousel'
                ? '(min-width: 640px) 288px, 68vw'
                : '(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw'
            }
            priority={priority}
            className="object-cover transition-transform duration-1000 ease-out group-hover:scale-[1.05]"
          />

          {/* Badges - top left */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {product.isNewArrival && (
              <span className="sticker">New</span>
            )}
            {product.isBestSeller && (
              <span className="sticker" style={{ background: 'linear-gradient(135deg, #8A74C9, #5E4B8B)' }}>
                Best Seller
              </span>
            )}
            {pct !== null && (
              <span className="sticker" style={{ background: 'linear-gradient(135deg, #7C3AED, #A855F7, #E879F9)', color: '#ffffff' }}>
                −{pct}%
              </span>
            )}
            {!product.inStock && (
              <span className="sticker" style={{ background: 'rgba(255,255,255,0.1)', color: '#A49BB8' }}>
                Sold Out
              </span>
            )}
          </div>

          {/* Wishlist */}
          <button
            type="button"
            onClick={onWish}
            aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
            aria-pressed={inWishlist}
            className="absolute top-3 right-3 w-10 h-10
                       flex items-center justify-center text-ivory
                       hover:text-lavender-pastel active:scale-90 transition-all duration-500"
            style={{
              borderRadius: '24px',
              background: 'rgba(76,29,149,0.75)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <Heart
              className={cn('w-4 h-4 transition-colors duration-500', inWishlist && 'fill-lavender-pastel text-lavender-pastel')}
              aria-hidden
            />
          </button>

          {/* Quick-add */}
          <button
            type="button"
            onClick={onAdd}
            disabled={!product.inStock}
            aria-label={`Add ${product.title} to cart`}
            className="absolute bottom-3 right-3 w-11 h-11
                       flex items-center justify-center text-plum
                       opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0
                       sm:opacity-100 sm:translate-y-0
                       active:scale-90 transition-all duration-500
                       disabled:opacity-40 disabled:pointer-events-none"
            style={{
              borderRadius: '24px',
              background: 'linear-gradient(135deg, #C8B6FF, #8A74C9)',
              boxShadow: '0 4px 16px rgba(138,116,201,0.3)',
            }}
          >
            <Plus className="w-5 h-5" aria-hidden />
          </button>
        </div>

        <div className="pt-4 px-1">
          <p className="text-[10px] uppercase tracking-[0.22em] text-ivory-mute mb-1.5">
            {product.category.replace('-', ' ')}
          </p>
          <h3 className="font-serif text-lg sm:text-xl leading-snug text-ivory
                         line-clamp-2 group-hover:text-lavender-pastel transition-colors duration-500">
            {product.title}
          </h3>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-ivory font-semibold tabular-nums">{formatINR(product.price)}</span>
            {product.compareAtPrice && (
              <span className="text-xs text-ivory-mute line-through tabular-nums">
                {formatINR(product.compareAtPrice)}
              </span>
            )}
          </div>
        </div>
      </Link>
    </article>
  )
}
