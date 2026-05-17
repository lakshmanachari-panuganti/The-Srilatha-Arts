import type { Metadata } from 'next'
import CategoryChips from '@/components/shop/CategoryChips'
import ProductListClient from '@/components/shop/ProductListClient'

export const metadata: Metadata = {
  title: 'Sale',
  description: 'Handmade art at special prices.',
}

export default function SalePage() {
  return (
    <>
      <CategoryChips />
      <header className="px-5 lg:px-8 pt-10 pb-2 max-w-6xl mx-auto">
        <p className="eyebrow mb-3">Special offers</p>
        <h1 className="display text-4xl md:text-5xl lg:text-7xl">
          On <em className="italic">sale</em>
        </h1>
        <p className="text-ink-soft text-sm mt-3">
          Use the code{' '}
          <span className="font-mono bg-paper border border-ink/15 px-2 py-0.5 rounded text-terracotta">
            SRILATHA30
          </span>{' '}
          at checkout to get an extra 30% off Resin pieces.
        </p>
      </header>
      <div className="max-w-6xl mx-auto py-8 lg:py-14">
        <ProductListClient filter="sale" />
      </div>
    </>
  )
}
