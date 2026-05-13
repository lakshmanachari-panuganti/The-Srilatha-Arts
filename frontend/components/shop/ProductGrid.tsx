import type { Product } from '@/types'
import ProductCard from './ProductCard'

export default function ProductGrid({ products }: { products: Product[] }) {
  if (products.length === 0) {
    return (
      <div className="px-5 py-20 text-center">
        <p className="font-serif text-2xl text-ink mb-2">No pieces here yet</p>
        <p className="text-sm text-ink-mute">Check back soon - Srilatha is at her bench.</p>
      </div>
    )
  }
  return (
    <ul className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-10 sm:gap-x-6 sm:gap-y-12 lg:gap-x-7 lg:gap-y-16 px-5 lg:px-8">
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} priority={i < 2} />
        </li>
      ))}
    </ul>
  )
}
