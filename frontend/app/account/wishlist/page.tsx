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
      <main className="min-h-svh max-w-2xl mx-auto px-5 py-16 lg:py-24 text-center">
        <Heart className="w-12 h-12 text-gold/50 mx-auto mb-4" aria-hidden />
        <h1 className="font-serif text-3xl md:text-4xl text-cream mb-3">
          Your <span className="gold-text">wishlist</span> is empty
        </h1>
        <p className="text-cream/65 mb-7">Tap the heart on any piece to save it for later.</p>
        <Link href="/shop" className="btn-gold">
          Browse the shop
          <ArrowRight className="w-4 h-4" aria-hidden />
        </Link>
      </main>
    )
  }

  return (
    <main className="max-w-7xl mx-auto px-5 lg:px-8 py-6 lg:py-12">
      <header className="mb-6">
        <h1 className="font-serif text-3xl md:text-4xl text-cream">Your wishlist</h1>
        <p className="text-cream/55 text-sm mt-1">
          {items.length} {items.length === 1 ? 'piece' : 'pieces'} saved
        </p>
      </header>

      <ul className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        {items.map((item) => (
          <li key={item.productId} className="relative">
            <Link href={`/product/${item.productId}`} className="block">
              <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-cream/5 border border-gold/10">
                <Image
                  src={item.image}
                  alt={item.title}
                  fill
                  sizes="(min-width: 1024px) 25vw, 50vw"
                  className="object-cover"
                />
              </div>
              <div className="pt-3 px-1">
                <h3 className="font-serif text-base text-cream line-clamp-2">{item.title}</h3>
                <p className="text-sm text-cream/80 mt-1">{formatINR(item.price)}</p>
              </div>
            </Link>
            <button
              onClick={() => remove(item.productId)}
              aria-label={`Remove ${item.title} from wishlist`}
              className="absolute top-2 right-2 w-9 h-9 rounded-full
                         bg-ink/40 backdrop-blur-sm border border-cream/15
                         flex items-center justify-center text-cream hover:bg-ink/60"
            >
              <X className="w-4 h-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}
