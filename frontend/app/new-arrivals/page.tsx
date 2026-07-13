import type { Metadata } from 'next'
import CategoryChips from '@/components/shop/CategoryChips'
import ProductListClient from '@/components/shop/ProductListClient'

export const metadata: Metadata = {
  title: 'New Arrivals',
  description: 'The newest handmade pieces from our studio.',
  alternates: { canonical: '/new-arrivals/' },
}

export default function NewArrivalsPage() {
  return (
    <>
      <CategoryChips />
      <header className="px-5 lg:px-8 pt-10 pb-2 max-w-6xl mx-auto">
        <p className="eyebrow mb-3">Just added</p>
        <h1 className="display text-4xl md:text-5xl lg:text-7xl">
          New <em className="not-italic">arrivals</em>
        </h1>
      </header>
      <div className="max-w-6xl mx-auto py-8 lg:py-14">
        <ProductListClient filter="new" />
      </div>
    </>
  )
}
