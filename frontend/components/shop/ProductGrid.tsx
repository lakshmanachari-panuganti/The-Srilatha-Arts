import type { Product } from '@/types'
import ProductCard from './ProductCard'

export default function ProductGrid({ products }: { products: Product[] }) {
  if (products.length === 0) {
    return (
      <div className="px-5 py-16 text-center">
        <p className="font-serif text-xl text-cream/70 mb-1">No pieces here yet</p>
        <p className="text-sm text-cream/40">Check back soon — Srilatha is at her bench.</p>
      </div>
    )
  }
  return (
    <ul className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 px-5 lg:px-8">
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} priority={i < 2} />
        </li>
      ))}
    </ul>
  )
}
