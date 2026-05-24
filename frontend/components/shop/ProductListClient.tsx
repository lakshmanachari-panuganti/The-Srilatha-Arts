'use client'

import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import ProductGrid from './ProductGrid'
import type { Product } from '@/types'

export type ProductFilter = 'all' | 'new' | 'best' | 'sale'

interface Props {
  filter?: ProductFilter
  category?: string
  showCount?: boolean
}

function GridSkeleton() {
  return (
    <ul className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-10 sm:gap-x-6 sm:gap-y-12 lg:gap-x-7 lg:gap-y-16 px-5 lg:px-8">
      {Array.from({ length: 8 }).map((_, i) => (
        <li key={i} className="animate-pulse">
          <div className="aspect-square rounded-2xl bg-purple-200/40 mb-4" />
          <div className="h-4 w-3/4 rounded bg-purple-200/40 mb-2" />
          <div className="h-3 w-1/2 rounded bg-purple-200/40" />
        </li>
      ))}
    </ul>
  )
}

export default function ProductListClient({ filter = 'all', category, showCount = false }: Props) {
  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['products', filter, category],
    queryFn: async () => {
      let path = '/products'
      if (category) path += `?category=${encodeURIComponent(category)}`
      else if (filter === 'new') path += '?newArrivals=true'
      else if (filter === 'best') path += '?bestSellers=true'
      const res = await apiFetch<{ products: Product[] }>(path)
      let items = res.products || []
      if (filter === 'sale') items = items.filter((p) => p.isOnSale)
      return items
    },
    staleTime: 60_000,
  })

  if (isLoading) return <GridSkeleton />

  return (
    <>
      {showCount && (
        <p className="text-purple-900/80 font-bold text-sm px-5 lg:px-8 mb-6">
          {products.length} {products.length === 1 ? 'piece' : 'pieces'} · made by hand, one at a time
        </p>
      )}
      <ProductGrid products={products} />
    </>
  )
}
