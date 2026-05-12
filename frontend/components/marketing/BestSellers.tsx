import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import ProductCard from '@/components/shop/ProductCard'
import { getBestSellers } from '@/data/products'

export default function BestSellers() {
  const products = getBestSellers()
  if (products.length === 0) return null

  return (
    <section className="px-5 lg:px-8 py-16 lg:py-28 max-w-6xl mx-auto">
      <div className="flex items-end justify-between mb-10 lg:mb-14">
        <div>
          <p className="eyebrow mb-4">
            <span className="section-no text-terracotta">004</span>
            Loved by many
          </p>
          <h2 className="display text-4xl lg:text-6xl">
            Best{' '}
            <em className="italic">sellers</em>
          </h2>
        </div>
        <Link
          href="/best-sellers"
          className="hidden sm:inline-flex items-center gap-1 text-sm text-ink hover:text-terracotta transition-colors border-b border-ink/30 hover:border-terracotta pb-1"
        >
          View all
          <ArrowRight className="w-4 h-4" aria-hidden />
        </Link>
      </div>

      <div className="lg:hidden">
        <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-5 px-5 scrollbar-hide">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} variant="carousel" />
          ))}
          <div className="shrink-0 w-2" aria-hidden />
        </div>
      </div>
      <div className="hidden lg:grid grid-cols-4 gap-7">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  )
}
