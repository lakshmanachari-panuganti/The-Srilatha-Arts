'use client'
import Link from 'next/link'
import Image from 'next/image'
import { Heart, Plus } from 'lucide-react'
import type { Product } from '@/types'
import { formatINR, discountPct } from '@/lib/format'
import { useCart } from '@/stores/cart'
import { useWishlist } from '@/stores/wishlist'
import { useHaptic } from '@/hooks/useHaptic'
import { cn } from '@/lib/cn'

interface Props {
  product: Product
  variant?: 'grid' | 'carousel'
  priority?: boolean
}

export default function ProductCard({ product, variant = 'grid', priority = false }: Props) {
  const addToCart = useCart((s) => s.add)
  const toggleWishlist = useWishlist((s) => s.toggle)
  const inWishlist = useWishlist((s) => s.has(product.id))
  const haptic = useHaptic()

  const pct = discountPct(product.price, product.compareAtPrice)

  const onAdd = (e: React.MouseEvent) => {
    e.preventDefault()
    addToCart(product)
    haptic([12, 30, 12])
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
        <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-cream-deep">
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
            className="object-contain p-6 sm:p-8 transition-transform duration-700 group-hover:scale-[1.04]"
          />

          {/* Badges — top left */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {product.isNewArrival && (
              <span className="sticker">New</span>
            )}
            {product.isBestSeller && (
              <span className="sticker bg-terracotta">Best Seller</span>
            )}
            {pct !== null && (
              <span className="sticker bg-gold text-ink">−{pct}%</span>
            )}
            {!product.inStock && (
              <span className="sticker bg-ink-mute">Sold Out</span>
            )}
          </div>

          {/* Wishlist */}
          <button
            type="button"
            onClick={onWish}
            aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
            aria-pressed={inWishlist}
            className="absolute top-3 right-3 w-10 h-10 rounded-full
                       bg-cream/85 backdrop-blur-sm
                       flex items-center justify-center text-ink
                       hover:bg-cream active:scale-90 transition shadow-soft"
          >
            <Heart
              className={cn('w-4 h-4 transition-colors', inWishlist && 'fill-terracotta text-terracotta')}
              aria-hidden
            />
          </button>

          {/* Quick-add */}
          <button
            type="button"
            onClick={onAdd}
            disabled={!product.inStock}
            aria-label={`Add ${product.title} to cart`}
            className="absolute bottom-3 right-3 w-11 h-11 rounded-full
                       bg-ink text-cream shadow-card
                       flex items-center justify-center
                       opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0
                       sm:opacity-100 sm:translate-y-0
                       active:scale-90 transition
                       disabled:opacity-40 disabled:pointer-events-none"
          >
            <Plus className="w-5 h-5" aria-hidden />
          </button>
        </div>

        <div className="pt-4 px-1">
          <p className="text-[10px] uppercase tracking-[0.22em] text-ink-mute mb-1.5">
            {product.category.replace('-', ' ')}
          </p>
          <h3 className="font-serif text-lg sm:text-xl leading-snug text-ink
                         line-clamp-2 group-hover:text-terracotta transition-colors">
            {product.title}
          </h3>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-ink font-medium">{formatINR(product.price)}</span>
            {product.compareAtPrice && (
              <span className="text-xs text-ink-mute line-through">
                {formatINR(product.compareAtPrice)}
              </span>
            )}
          </div>
        </div>
      </Link>
    </article>
  )
}
