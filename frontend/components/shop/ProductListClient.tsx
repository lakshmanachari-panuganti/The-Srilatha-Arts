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
          <div className="aspect-square rounded-2xl bg-ink/8 mb-4" />
          <div className="h-4 w-3/4 rounded bg-ink/8 mb-2" />
          <div className="h-3 w-1/2 rounded bg-ink/8" />
        </li>
      ))}
    </ul>
  )
}

// Distinct network / server error state — separate from the "no products
// yet" empty state so the visitor knows the fault is transient and can
// retry rather than assume the studio is bare. Audit C4.
function GridErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="px-5 py-16 text-center max-w-md mx-auto">
      <p className="font-display text-2xl text-ivory mb-2">
        We couldn&apos;t load the pieces
      </p>
      <p className="text-sm text-ivory-mute mb-5">
        The studio is having a moment — please try again in a second.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center justify-center min-h-10 px-5 text-xs font-semibold uppercase
                   text-white rounded-lg bg-gradient-to-br from-blue to-indigo
                   hover:from-blue-strong hover:to-indigo-strong
                   shadow-lavender-glow transition-colors duration-300"
        style={{ letterSpacing: '0.14em' }}
      >
        Try again
      </button>
    </div>
  )
}

export default function ProductListClient({ filter = 'all', category, showCount = false }: Props) {
  const { data: products = [], isLoading, isError, refetch } = useQuery<Product[]>({
    queryKey: ['products', filter, category],
    queryFn: async () => {
      let path = '/products'
      if (category) path += `?category=${encodeURIComponent(category)}`
      else if (filter === 'new') path += '?newArrivals=true'
      else if (filter === 'best') path += '?bestSellers=true'
      else if (filter === 'sale') path += '?onSale=true'
      const res = await apiFetch<{ products: Product[] }>(path)
      return res.products || []
    },
    staleTime: 60_000,
    retry: 1,
  })

  if (isLoading) return <GridSkeleton />
  if (isError) return <GridErrorState onRetry={() => refetch()} />

  return (
    <>
      {showCount && (
        <p className="text-ink-mute text-sm px-5 lg:px-8 mb-6">
          {products.length} {products.length === 1 ? 'piece' : 'pieces'} · made by hand, one at a time
        </p>
      )}
      <ProductGrid products={products} />
    </>
  )
}
