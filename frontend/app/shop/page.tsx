import type { Metadata } from 'next'
import CategoryChips from '@/components/shop/CategoryChips'
import ProductListClient from '@/components/shop/ProductListClient'

export const metadata: Metadata = {
  title: 'Shop all handmade art',
  description:
    'Browse all our handmade pieces — Resin, Dot Mandala, Lippan, Pichwai and Kolam — made by hand in Hyderabad.',
}

export default function ShopPage() {
  return (
    <>
      <CategoryChips />
      <header className="px-5 lg:px-8 pt-10 pb-2 max-w-6xl mx-auto">
        <p className="eyebrow mb-3">Shop</p>
        <h1 className="display text-4xl md:text-5xl lg:text-7xl">
          All <em className="italic">pieces</em>
        </h1>
      </header>
      <div className="max-w-6xl mx-auto py-8 lg:py-14">
        <ProductListClient filter="all" showCount />
      </div>
    </>
  )
}
