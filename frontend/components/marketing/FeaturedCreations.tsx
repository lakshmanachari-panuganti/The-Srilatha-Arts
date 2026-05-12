import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import ProductCard from '@/components/shop/ProductCard'
import { getFeaturedProducts } from '@/data/products'

export default function FeaturedCreations() {
  const products = getFeaturedProducts()
  if (products.length === 0) return null

  return (
    <section className="py-12 lg:py-20 max-w-7xl mx-auto">
      <div className="flex items-end justify-between px-5 lg:px-8 mb-6 lg:mb-10">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-gold-light/70 mb-2">
            From the studio
          </p>
          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl text-cream">
            Featured <span className="gold-text">creations</span>
          </h2>
        </div>
        <Link
          href="/shop"
          className="hidden sm:inline-flex items-center gap-1 text-sm text-gold hover:text-gold-light transition-colors"
        >
          See all
          <ArrowRight className="w-4 h-4" aria-hidden />
        </Link>
      </div>

      {/* Mobile: horizontal scroll · Desktop: grid */}
      <div className="lg:hidden">
        <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 px-5 scrollbar-hide">
          {products.map((p, i) => (
            <ProductCard key={p.id} product={p} variant="carousel" priority={i < 2} />
          ))}
          {/* trailing peek-spacer */}
          <div className="shrink-0 w-5" aria-hidden />
        </div>
      </div>
      <div className="hidden lg:grid grid-cols-4 gap-6 px-5 lg:px-8">
        {products.map((p, i) => (
          <ProductCard key={p.id} product={p} priority={i < 2} />
        ))}
      </div>

      <div className="px-5 lg:px-8 mt-6 sm:hidden">
        <Link href="/shop" className="btn-outline w-full justify-center">
          See all creations
          <ArrowRight className="w-4 h-4" aria-hidden />
        </Link>
      </div>
    </section>
  )
}
