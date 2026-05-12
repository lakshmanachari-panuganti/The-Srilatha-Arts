import type { Metadata } from 'next'
import CategoryChips from '@/components/shop/CategoryChips'
import ProductGrid from '@/components/shop/ProductGrid'
import { getBestSellers } from '@/data/products'

export const metadata: Metadata = {
  title: 'Best Sellers',
  description: 'The pieces our community loves most.',
}

export default function BestSellersPage() {
  const products = getBestSellers()
  return (
    <>
      <CategoryChips />
      <header className="px-5 lg:px-8 pt-6 pb-2 max-w-7xl mx-auto">
        <p className="text-[11px] uppercase tracking-[0.3em] text-gold-light/70 mb-1">
          Most loved
        </p>
        <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl text-cream">
          Best <span className="gold-text">sellers</span>
        </h1>
      </header>
      <div className="max-w-7xl mx-auto py-6 lg:py-10">
        <ProductGrid products={products} />
      </div>
    </>
  )
}
