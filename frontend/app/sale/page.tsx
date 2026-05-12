import type { Metadata } from 'next'
import CategoryChips from '@/components/shop/CategoryChips'
import ProductGrid from '@/components/shop/ProductGrid'
import { PRODUCTS } from '@/data/products'

export const metadata: Metadata = {
  title: 'Sale',
  description: 'Discounted pieces — handcrafted, still.',
}

export default function SalePage() {
  const products = PRODUCTS.filter((p) => p.isOnSale)
  return (
    <>
      <CategoryChips />
      <header className="px-5 lg:px-8 pt-10 pb-2 max-w-6xl mx-auto">
        <p className="eyebrow mb-3">A small festival</p>
        <h1 className="display text-4xl md:text-5xl lg:text-7xl">
          On <em className="italic">sale</em>
        </h1>
        <p className="text-ink-soft text-sm mt-3">
          Use code{' '}
          <span className="font-mono bg-paper border border-ink/15 px-2 py-0.5 rounded text-terracotta">
            SRILATHA30
          </span>{' '}
          for an extra 30% off Resin pieces.
        </p>
      </header>
      <div className="max-w-6xl mx-auto py-8 lg:py-14">
        <ProductGrid products={products} />
      </div>
    </>
  )
}
