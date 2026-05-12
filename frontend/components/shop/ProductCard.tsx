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
        variant === 'carousel' ? 'w-[64vw] sm:w-72 shrink-0 snap-start' : '',
      )}
    >
      <Link href={`/product/${product.id}`} className="block">
        <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-cream/5 border border-gold/10">
          <Image
            src={product.images[0]}
            alt={product.title}
            fill
            sizes={
              variant === 'carousel'
                ? '(min-width: 640px) 288px, 64vw'
                : '(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw'
            }
            priority={priority}
            className="object-cover transition-transform duration-700 group-hover:scale-[1.05]"
          />

          {/* Gradient ink so badges stay readable */}
          <div className="absolute inset-0 bg-gradient-to-t from-ink/55 via-transparent to-ink/15" />

          {/* Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1.5">
            {product.isNewArrival && (
              <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider rounded-full
                               bg-cream/95 text-primary-dark font-semibold">
                New
              </span>
            )}
            {product.isBestSeller && (
              <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider rounded-full
                               bg-gold text-primary-dark font-semibold">
                Best Seller
              </span>
            )}
            {pct !== null && (
              <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider rounded-full
                               bg-primary-burnt text-cream font-semibold">
                −{pct}%
              </span>
            )}
            {!product.inStock && (
              <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider rounded-full
                               bg-ink/80 text-cream/80 font-semibold">
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
            className="absolute top-2 right-2 w-9 h-9 rounded-full
                       bg-ink/40 backdrop-blur-sm border border-cream/15
                       flex items-center justify-center text-cream
                       hover:bg-ink/60 active:scale-90 transition"
          >
            <Heart
              className={cn('w-4 h-4 transition-colors', inWishlist && 'fill-gold text-gold')}
              aria-hidden
            />
          </button>

          {/* Quick-add */}
          <button
            type="button"
            onClick={onAdd}
            disabled={!product.inStock}
            aria-label={`Add ${product.title} to cart`}
            className="absolute bottom-2 right-2 w-10 h-10 rounded-full
                       bg-gold text-primary-dark shadow-md shadow-gold/30
                       flex items-center justify-center
                       opacity-95 hover:opacity-100 active:scale-90 transition
                       disabled:opacity-40 disabled:pointer-events-none"
          >
            <Plus className="w-5 h-5" aria-hidden />
          </button>
        </div>

        <div className="pt-3 px-1">
          <p className="text-[10px] uppercase tracking-[0.18em] text-gold-light/70 mb-1">
            {product.category.replace('-', ' ')}
          </p>
          <h3 className="font-serif text-base sm:text-lg leading-snug text-cream
                         line-clamp-2 group-hover:text-gold-light transition-colors">
            {product.title}
          </h3>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-cream font-medium">{formatINR(product.price)}</span>
            {product.compareAtPrice && (
              <span className="text-xs text-cream/40 line-through">
                {formatINR(product.compareAtPrice)}
              </span>
            )}
          </div>
        </div>
      </Link>
    </article>
  )
}
