'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import ProductCard from '@/components/shop/ProductCard'
import { apiFetch } from '@/lib/api'
import type { Product } from '@/types'

export default function BestSellers() {
  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['products', 'best'],
    queryFn: async () => {
      const res = await apiFetch<{ products: Product[] }>('/products?bestSellers=true')
      return res.products || []
    },
    staleTime: 60_000,
  })

  if (isLoading || products.length === 0) return null

  return (
    <section className="px-5 lg:px-8 py-14 sm:py-20 lg:py-32 max-w-6xl mx-auto">
      <div className="flex items-end justify-between mb-8 sm:mb-12 lg:mb-16">
        <div>
          <p className="eyebrow mb-4">
            <span className="section-no text-lavender-pastel">004</span>
            Most loved
          </p>
          <h2 className="display text-4xl lg:text-6xl">
            Best{' '}
            <em className="italic">sellers</em>
          </h2>
        </div>
        <Link
          href="/best-sellers"
          className="hidden sm:inline-flex items-center gap-1 text-sm text-ivory-soft
                     hover:text-lavender-pastel transition-colors duration-500
                     border-b border-ivory-soft/30 hover:border-lavender-pastel pb-1"
        >
          View all
          <ArrowRight className="w-4 h-4" aria-hidden />
        </Link>
      </div>

      <div className="lg:hidden">
        <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-5 px-5 scrollbar-hide">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} variant="carousel" />
          ))}
          <div className="shrink-0 w-2" aria-hidden />
        </div>
      </div>
      <div className="hidden lg:grid grid-cols-4 gap-7">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  )
}
