import type { Metadata } from 'next'
import CategoryChips from '@/components/shop/CategoryChips'
import ProductListClient from '@/components/shop/ProductListClient'
import SaleCoupons from './SaleCoupons'

export const metadata: Metadata = {
  title: 'Sale',
  description: 'Handmade art at special prices.',
  alternates: { canonical: '/sale/' },
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
        <SaleCoupons />
      </header>
      <div className="max-w-6xl mx-auto py-8 lg:py-14">
        <ProductListClient filter="sale" />
      </div>
    </>
  )
}
