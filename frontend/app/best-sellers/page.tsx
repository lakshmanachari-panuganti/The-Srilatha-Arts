import type { Metadata } from 'next'
import CategoryChips from '@/components/shop/CategoryChips'
import ProductListClient from '@/components/shop/ProductListClient'

export const metadata: Metadata = {
  title: 'Best sellers',
  description: 'The pieces our customers love most.',
  alternates: { canonical: '/best-sellers/' },
}

export default function BestSellersPage() {
  return (
    <>
      <CategoryChips />
      <header className="px-5 lg:px-8 pt-10 pb-2 max-w-6xl mx-auto">
        <p className="eyebrow mb-3">Most loved</p>
        <h1 className="display text-4xl md:text-5xl lg:text-7xl">
          Best <em className="italic">sellers</em>
        </h1>
      </header>
      <div className="max-w-6xl mx-auto py-8 lg:py-14">
        <ProductListClient filter="best" />
      </div>
    </>
  )
}
