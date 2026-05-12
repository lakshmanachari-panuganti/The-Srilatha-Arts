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
      <header className="px-5 lg:px-8 pt-10 pb-2 max-w-6xl mx-auto">
        <p className="eyebrow mb-3">Just off the bench</p>
        <h1 className="display text-4xl md:text-5xl lg:text-7xl">
          New <em className="italic">arrivals</em>
        </h1>
      </header>
      <div className="max-w-6xl mx-auto py-8 lg:py-14">
        <ProductGrid products={products} />
      </div>
    </>
  )
}
