'use client'
import Link from 'next/link'
import Image from 'next/image'
import { Heart, ArrowRight, X } from 'lucide-react'
import { useWishlist } from '@/stores/wishlist'
import { formatINR } from '@/lib/format'

export default function WishlistPage() {
  const items = useWishlist((s) => s.items)
  const remove = useWishlist((s) => s.remove)

  if (items.length === 0) {
    return (
      <main className="min-h-svh max-w-2xl mx-auto px-5 py-20 lg:py-28 text-center">
        <Heart className="w-12 h-12 text-lavender-pastel/60 mx-auto mb-4" aria-hidden />
        <p className="eyebrow justify-center mb-3">Wishlist</p>
        <h1 className="display text-4xl md:text-5xl mb-4">
          Your <em className="not-italic">wishlist</em> is empty
        </h1>
        <p className="text-ink-soft mb-8">Tap the heart icon on any piece to save it for later.</p>
        <Link href="/shop" className="btn-dark">
          Start shopping
          <ArrowRight className="w-4 h-4" aria-hidden />
        </Link>
      </main>
    )
  }

  return (
    <main className="max-w-6xl mx-auto px-5 lg:px-8 py-10 lg:py-16">
      <header className="mb-8">
        <p className="eyebrow mb-3">Wishlist</p>
        <h1 className="display text-4xl md:text-5xl">Your saved pieces</h1>
        <p className="text-ink-mute text-sm mt-2">
          {items.length} {items.length === 1 ? 'piece' : 'pieces'} saved for later
        </p>
      </header>

      <ul className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-10 sm:gap-6">
        {items.map((item) => (
          <li key={item.productId} className="relative">
            <Link href={`/product/${item.productId}`} className="block">
              <div className="relative aspect-[4/5] rounded-3xl overflow-hidden bg-cream-deep">
                <Image
                  src={item.image}
                  alt={item.title}
                  fill
                  sizes="(min-width: 1024px) 25vw, 50vw"
                  className="object-contain p-6"
                />
              </div>
              <div className="pt-4 px-1">
                <h3 className="font-serif text-base text-ink line-clamp-2">{item.title}</h3>
                {/* Price row mirrors the product card: bold current price
                    + strikethrough "was" when the piece is on sale. */}
                <div className="flex items-baseline gap-2 mt-1.5">
                  <span className="text-sm font-semibold text-ink tabular-nums">
                    {formatINR(item.price)}
                  </span>
                  {item.compareAtPrice && item.compareAtPrice > item.price && (
                    <span className="text-xs text-ink-mute line-through tabular-nums">
                      {formatINR(item.compareAtPrice)}
                    </span>
                  )}
                </div>
              </div>
            </Link>
            <button
              onClick={() => remove(item.productId)}
              aria-label={`Remove ${item.title} from wishlist`}
              className="absolute top-3 right-3 w-10 h-10 rounded-full
                         bg-cream/90 backdrop-blur-sm shadow-soft
                         flex items-center justify-center text-ink hover:bg-cream"
            >
              <X className="w-4 h-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}
