import type { Metadata } from 'next'
import CategoryChips from '@/components/shop/CategoryChips'
import ProductGrid from '@/components/shop/ProductGrid'
import { getAllProducts } from '@/data/products'

export const metadata: Metadata = {
  title: 'Shop · All handcrafted art',
  description:
    'Browse the full collection - Resin, Dot Mandala, Lippan, Pichwai and Kolam art handcrafted in Hyderabad.',
}

export default async function ShopPage() {
  const products = await getAllProducts()
  return (
    <>
      <CategoryChips />
      <header className="px-5 lg:px-8 pt-10 pb-2 max-w-6xl mx-auto">
        <p className="eyebrow mb-3">The collection</p>
        <h1 className="display text-4xl md:text-5xl lg:text-7xl">
          All <em className="italic">creations</em>
        </h1>
        <p className="text-ink-mute text-sm mt-3">
          {products.length} pieces · handcrafted, one at a time
        </p>
      </header>
      <div className="max-w-6xl mx-auto py-8 lg:py-14">
        <ProductGrid products={products} />
      </div>
    </>
  )
}
