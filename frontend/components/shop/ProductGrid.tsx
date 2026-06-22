import type { Product } from '@/types'
import ProductCard from './ProductCard'

export default function ProductGrid({ products }: { products: Product[] }) {
  if (products.length === 0) {
    return (
      <div className="px-5 py-20 text-center">
        <p className="font-display text-2xl text-slate-900 mb-2">No pieces here yet</p>
        <p className="text-sm text-slate-500">Check back soon — Srilatha is at her bench.</p>
      </div>
    )
  }
  return (
    <ul
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5
                 gap-x-4 gap-y-8 sm:gap-x-5 sm:gap-y-10 lg:gap-x-6 lg:gap-y-12
                 px-5 lg:px-8"
    >
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} priority={i < 3} />
        </li>
      ))}
    </ul>
  )
}
