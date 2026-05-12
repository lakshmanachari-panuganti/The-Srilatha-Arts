import type { Metadata } from 'next'
import CategoryChips from '@/components/shop/CategoryChips'
import ProductGrid from '@/components/shop/ProductGrid'
import { PRODUCTS } from '@/data/products'

export const metadata: Metadata = {
  title: 'Shop · All handcrafted art',
  description:
    'Browse the full collection — Resin, Dot Mandala, Lippan, Pichwai and Kolam art handcrafted in Hyderabad.',
}

export default function ShopPage() {
  return (
    <>
      <CategoryChips />
      <header className="px-5 lg:px-8 pt-6 pb-2 max-w-7xl mx-auto">
        <p className="text-[11px] uppercase tracking-[0.3em] text-gold-light/70 mb-1">
          The collection
        </p>
        <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl text-cream">
          All <span className="gold-text">creations</span>
        </h1>
        <p className="text-cream/55 text-sm mt-2">
          {PRODUCTS.length} pieces · handcrafted, one at a time
        </p>
      </header>
      <div className="max-w-7xl mx-auto py-6 lg:py-10">
        <ProductGrid products={PRODUCTS} />
      </div>
    </>
  )
}
