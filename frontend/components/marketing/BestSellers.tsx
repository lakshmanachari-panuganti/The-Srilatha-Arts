import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import ProductCard from '@/components/shop/ProductCard'
import { getBestSellers } from '@/data/products'

export default function BestSellers() {
  const products = getBestSellers()
  if (products.length === 0) return null

  return (
    <section className="py-12 lg:py-20 max-w-7xl mx-auto">
      <div className="flex items-end justify-between px-5 lg:px-8 mb-6 lg:mb-10">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-gold-light/70 mb-2">
            Loved by many
          </p>
          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl text-cream">
            Best <span className="gold-text">sellers</span>
          </h2>
        </div>
        <Link
          href="/best-sellers"
          className="hidden sm:inline-flex items-center gap-1 text-sm text-gold hover:text-gold-light transition-colors"
        >
          See all
          <ArrowRight className="w-4 h-4" aria-hidden />
        </Link>
      </div>

      <div className="lg:hidden">
        <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 px-5 scrollbar-hide">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} variant="carousel" />
          ))}
          <div className="shrink-0 w-5" aria-hidden />
        </div>
      </div>
      <div className="hidden lg:grid grid-cols-4 gap-6 px-5 lg:px-8">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  )
}
