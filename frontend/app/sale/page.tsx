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
      <header className="px-5 lg:px-8 pt-6 pb-2 max-w-7xl mx-auto">
        <p className="text-[11px] uppercase tracking-[0.3em] text-gold-light/70 mb-1">
          A small festival
        </p>
        <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl text-cream">
          On <span className="gold-text">sale</span>
        </h1>
        <p className="text-cream/60 text-sm mt-2">
          Use code <span className="font-mono text-gold">SRILATHA30</span> for an extra 30% off Resin pieces.
        </p>
      </header>
      <div className="max-w-7xl mx-auto py-6 lg:py-10">
        <ProductGrid products={products} />
      </div>
    </>
  )
}
