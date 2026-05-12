import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import ProductCard from '@/components/shop/ProductCard'
import { getFeaturedProducts } from '@/data/products'

export default function FeaturedCreations() {
  const products = getFeaturedProducts()
  if (products.length === 0) return null

  return (
    <section className="bg-cream-deep py-16 lg:py-28">
      <div className="max-w-6xl mx-auto">
        <div className="px-5 lg:px-8 flex items-end justify-between mb-10 lg:mb-14">
          <div>
            <p className="eyebrow mb-4">
              <span className="section-no text-terracotta">002</span>
              From the bench
            </p>
            <h2 className="display text-4xl lg:text-6xl">
              Featured
              <br className="sm:hidden" />
              <em className="italic"> creations</em>
            </h2>
          </div>
          <Link
            href="/shop"
            className="hidden sm:inline-flex items-center gap-1 text-sm text-ink hover:text-terracotta transition-colors border-b border-ink/30 hover:border-terracotta pb-1"
          >
            View all
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        </div>

        {/* Mobile carousel */}
        <div className="lg:hidden">
          <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 px-5 scrollbar-hide">
            {products.map((p, i) => (
              <ProductCard key={p.id} product={p} variant="carousel" priority={i < 2} />
            ))}
            <div className="shrink-0 w-5" aria-hidden />
          </div>
        </div>

        {/* Desktop grid */}
        <div className="hidden lg:grid grid-cols-4 gap-7 px-8">
          {products.map((p, i) => (
            <ProductCard key={p.id} product={p} priority={i < 2} />
          ))}
        </div>

        <div className="px-5 mt-6 sm:hidden">
          <Link href="/shop" className="btn-outline w-full justify-center">
            View all creations
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  )
}
