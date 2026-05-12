import type { Metadata } from 'next'
import CategoryChips from '@/components/shop/CategoryChips'
import ProductGrid from '@/components/shop/ProductGrid'
import { getNewArrivals } from '@/data/products'

export const metadata: Metadata = {
  title: 'New Arrivals',
  description: 'The latest creations from the studio.',
}

export default function NewArrivalsPage() {
  const products = getNewArrivals()
  return (
    <>
      <CategoryChips />
      <header className="px-5 lg:px-8 pt-6 pb-2 max-w-7xl mx-auto">
        <p className="text-[11px] uppercase tracking-[0.3em] text-gold-light/70 mb-1">
          Just off the bench
        </p>
        <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl text-cream">
          New <span className="gold-text">arrivals</span>
        </h1>
      </header>
      <div className="max-w-7xl mx-auto py-6 lg:py-10">
        <ProductGrid products={products} />
      </div>
    </>
  )
}
