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
                        bg-gradient-to-b from-plum-warm/80 to-plum-light/60
                        border border-glass-border
                        transition-all duration-700
                        group-hover:border-lavender-pastel/20
                        group-hover:shadow-lavender-glow"
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
            className="object-contain p-6 sm:p-8 transition-transform duration-1000 ease-out group-hover:scale-[1.04]"
          />

          {/*
            Badges — top-left. Capped at 2 visible to avoid a sticker pile
            covering the upper-left quadrant of the image. Priority order:
            Sold Out > discount % > Best Seller > New (the most important
            commercial signal wins).
          */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {/*
              Sticker priority: Sold Out > Low stock > discount > Best Seller > New.
              Capped at 2 visible. Low-stock cue is honest urgency — handcrafted
              inventory is genuinely limited, so "Only N left" is truthful (audit §3).
            */}
            {(() => {
              const badges: React.ReactNode[] = []
              if (!product.inStock) {
                badges.push(
                  <span key="oos" className="sticker" style={{ background: 'rgba(255,255,255,0.1)', color: '#A49BB8' }}>
                    Sold Out
                  </span>,
                )
              }
              if (badges.length < 2 && product.inStock && product.stockQty > 0 && product.stockQty <= 2) {
                badges.push(
                  <span key="low" className="sticker" style={{ background: 'linear-gradient(135deg, #E879F9, #A78BFA)', color: '#ffffff' }}>
                    Only {product.stockQty} left
                  </span>,
                )
              }
              if (badges.length < 2 && pct !== null) {
                badges.push(
                  <span key="disc" className="sticker" style={{ background: 'linear-gradient(135deg, #7C3AED, #A855F7, #E879F9)', color: '#ffffff' }}>
                    −{pct}%
                  </span>,
                )
              }
              if (badges.length < 2 && product.isBestSeller) {
                badges.push(
                  <span key="best" className="sticker" style={{ background: 'linear-gradient(135deg, #8A74C9, #5E4B8B)' }}>
                    Best Seller
                  </span>,
                )
              }
              if (badges.length < 2 && product.isNewArrival) {
                badges.push(<span key="new" className="sticker">New</span>)
              }
              return badges
            })()}
          </div>

          {/*
            Wishlist heart — moved to a high-contrast pale chip so it pops
            against the lavender-gradient card. Previous version used a
            plum-purple chip that visually disappeared into the card.
          */}
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
              background: 'rgba(255,255,255,0.92)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(167,139,250,0.40)',
              boxShadow: '0 2px 10px rgba(75,63,114,0.10)',
            }}
          >
            <Heart
              className={cn(
                'w-4 h-4 transition-colors duration-500',
                inWishlist ? 'fill-lavender-pastel text-lavender-pastel' : 'text-ivory-soft',
              )}
              aria-hidden
            />
          </button>

          {/*
            Quick-add. Previously hidden until :hover, which on touch devices
            meant the button was effectively invisible. Always-visible on
            every viewport so a customer can add from the grid without
            committing to a PDP. Hover still nudges it visually on desktop.
          */}
          <button
            type="button"
            onClick={onAdd}
            disabled={!product.inStock}
            aria-label={`Add ${product.title} to cart`}
            className="absolute bottom-3 right-3 w-11 h-11
                       flex items-center justify-center text-plum
                       opacity-100 lg:opacity-90 lg:group-hover:opacity-100
                       lg:scale-95 lg:group-hover:scale-100
                       active:scale-90 transition-all duration-500
                       disabled:opacity-40 disabled:pointer-events-none"
            style={{
              borderRadius: '24px',
              background: 'linear-gradient(135deg, #A78BFA, #7C3AED)',
              boxShadow: '0 4px 16px rgba(138,116,201,0.3)',
            }}
          >
            <Plus className="w-5 h-5" aria-hidden />
          </button>
        </div>

        <div className="pt-4 px-1">
          <p className="text-10 uppercase tracking-[0.22em] text-ivory-mute mb-1.5">
            {product.category.replace('-', ' ')}
          </p>
          {/*
            Mobile uses DM Sans at 15px — Cormorant at this size on a card
            reads decoratively where it should read functionally. From the
            sm breakpoint up, where the card is larger and the title gets
            real estate, the Cormorant serif comes back. Audit §2.5.
          */}
          <h3 className="font-sans text-[15px] tracking-tight
                         sm:font-serif sm:text-xl sm:tracking-normal
                         leading-snug text-ivory
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
