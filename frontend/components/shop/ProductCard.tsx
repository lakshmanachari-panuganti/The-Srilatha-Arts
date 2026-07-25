'use client'
import Link from 'next/link'
import PictureImage from '@/components/PictureImage'
import { Heart, Plus } from 'lucide-react'
import type { Product } from '@/types'
import { formatINR, discountPct } from '@/lib/format'
import { useWishlist } from '@/stores/wishlist'
import { useAddToCart } from '@/hooks/useAddToCart'
import { useToggleWishlist } from '@/hooks/useToggleWishlist'
import { useHaptic } from '@/hooks/useHaptic'
import { cn } from '@/lib/cn'

interface Props {
  product: Product
  variant?: 'grid' | 'carousel'
  priority?: boolean
}

interface Badge {
  key: string
  label: string
  className: string
}

export default function ProductCard({ product, variant = 'grid', priority = false }: Props) {
  const { addToCart } = useAddToCart()
  const { toggleWishlist } = useToggleWishlist()
  const inWishlist = useWishlist((s) => s.has(product.id))
  const haptic = useHaptic()

  const pct = discountPct(product.price, product.compareAtPrice)

  const onAdd = (e: React.MouseEvent) => {
    e.preventDefault()
    if (addToCart(product)) haptic([12, 30, 12])
  }

  const onWish = (e: React.MouseEvent) => {
    e.preventDefault()
    if (toggleWishlist(product)) haptic(10)
  }

  // Priority order: availability → urgency → savings → social proof
  const badges: Badge[] = []
  if (!product.inStock) {
    badges.push({
      key: 'oos',
      label: 'Sold Out',
      className: 'bg-white/5 border border-white/10 text-slate-400',
    })
  }
  if (product.inStock && product.stockQty > 0 && product.stockQty <= 2) {
    badges.push({
      key: 'low',
      label: `Only ${product.stockQty} left`,
      className: 'bg-amber-500/20 border border-amber-500/25 text-amber-300',
    })
  }
  if (pct !== null) {
    badges.push({
      key: 'disc',
      label: `−${pct}%`,
      className: 'bg-emerald-500/20 border border-emerald-500/25 text-emerald-300',
    })
  }
  if (product.isBestSeller) {
    badges.push({
      key: 'best',
      label: 'Best Seller',
      className: 'bg-blue/10 border border-blue/25 text-blue',
    })
  }
  if (product.isNewArrival) {
    badges.push({
      key: 'new',
      label: 'New',
      className: 'bg-cyan/10 border border-cyan/25 text-cyan',
    })
  }

  return (
    <article
      className={cn(
        'group relative',
        variant === 'carousel' ? 'w-[60vw] sm:w-60 shrink-0 snap-start' : '',
      )}
    >
      <Link href={`/product/${product.id}`} className="block">
        {/* Product image — fully unobstructed */}
        <div
          className="relative aspect-square overflow-hidden rounded-lg
                     bg-gradient-to-br from-plum-warm to-plum-light
                     border border-white/10
                     transition-all duration-500
                     group-hover:border-blue/40
                     group-hover:shadow-card-hover"
        >
          <PictureImage
            src={product.images[0]}
            alt={product.title}
            fill
            sizes={
              variant === 'carousel'
                ? '(min-width: 640px) 240px, 60vw'
                : '(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw'
            }
            priority={priority}
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
          />

          {/* Wishlist heart */}
          <button
            type="button"
            onClick={onWish}
            aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
            aria-pressed={inWishlist}
            className="absolute top-2.5 right-2.5 w-9 h-9 rounded-lg
                       flex items-center justify-center
                       bg-slate-950/75 backdrop-blur border border-white/10
                       text-ivory-soft hover:text-blue hover:border-blue/50
                       active:scale-90 transition-all duration-300
                       shadow-soft"
          >
            <Heart
              className={cn(
                'w-4 h-4 transition-colors duration-300',
                inWishlist ? 'fill-blue text-blue' : 'text-ivory-soft group-hover:text-blue',
              )}
              aria-hidden
            />
          </button>

          {/* Quick-add */}
          <button
            type="button"
            onClick={onAdd}
            disabled={!product.inStock}
            aria-label={`Add ${product.title} to cart`}
            className="absolute bottom-2.5 right-2.5 w-10 h-10 rounded-lg
                       flex items-center justify-center text-white
                       bg-gradient-to-br from-blue to-indigo
                       shadow-lavender-glow
                       opacity-100 lg:opacity-0 lg:translate-y-1
                       lg:group-hover:opacity-100 lg:group-hover:translate-y-0
                       hover:from-blue-strong hover:to-indigo-strong
                       active:scale-90 transition-all duration-300
                       disabled:opacity-40 disabled:pointer-events-none"
          >
            <Plus className="w-4 h-4" aria-hidden />
          </button>
        </div>

        {/* Badge strip — below image, above category */}
        {badges.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2.5 px-0.5 min-h-0">
            {badges.map(({ key, label, className }) => (
              <span
                key={key}
                className={cn(
                  'inline-flex items-center px-2.5 py-[5px]',
                  'rounded-full border',
                  'text-[11px] font-semibold uppercase tracking-[0.09em] leading-none',
                  className,
                )}
              >
                {label}
              </span>
            ))}
          </div>
        )}

        {/* Product info */}
        <div className={cn('px-0.5', badges.length > 0 ? 'pt-2' : 'pt-3')}>
          <p className="text-[10px] uppercase tracking-[0.18em] text-ivory-mute mb-1">
            {product.category.replace('-', ' ')}
          </p>
          <h3 className="font-display text-[14px] sm:text-[15px] font-semibold
                         leading-snug text-ivory tracking-tight
                         line-clamp-2 group-hover:text-blue transition-colors duration-300">
            {product.title}
          </h3>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-ivory font-bold tabular-nums text-[15px]">{formatINR(product.price)}</span>
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
