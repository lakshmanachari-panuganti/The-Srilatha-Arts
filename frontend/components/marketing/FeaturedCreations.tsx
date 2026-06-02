'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import ProductCard from '@/components/shop/ProductCard'
import { apiFetch } from '@/lib/api'
import type { Product } from '@/types'

export default function FeaturedCreations() {
  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['products', 'featured'],
    queryFn: async () => {
      const res = await apiFetch<{ products: Product[] }>('/products?featured=true')
      return res.products || []
    },
    staleTime: 60_000,
  })

  if (isLoading || products.length === 0) return null

  return (
    <section className="relative py-14 sm:py-20 lg:py-32 overflow-hidden">
      {/* Section background - subtle vertical wash, no glow orb. The hero
          slideshow already owns the ambient-glow visual; repeating it in
          every section devalues the effect (audit §1.6). */}
      <div className="absolute inset-0 bg-gradient-to-b from-plum-light/50 via-plum to-plum" aria-hidden />

      <div className="relative max-w-6xl mx-auto z-10">
        <div className="px-5 lg:px-8 flex items-end justify-between mb-8 sm:mb-12 lg:mb-16">
          <div>
            <p className="eyebrow mb-4">Picked for you</p>
            <h2 className="display text-4xl lg:text-6xl">
              Featured
              <br className="sm:hidden" />
              <em className="italic"> pieces</em>
            </h2>
          </div>
          <Link
            href="/shop"
            className="hidden sm:inline-flex items-center gap-1 text-sm text-ivory-soft
                       hover:text-lavender-pastel transition-colors duration-500
                       border-b border-ivory-soft/30 hover:border-lavender-pastel pb-1"
          >
            View all
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        </div>

        {/* Mobile carousel */}
        <div className="lg:hidden">
          <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 px-5 scrollbar-hide">
            {products.map((p, i) => (
              <ProductCard key={p.id} product={p} variant="carousel" priority={i < 2} />
            ))}
            <div className="shrink-0 w-5" aria-hidden />
          </div>
        </div>

        {/* Desktop grid */}
        <div className="hidden lg:grid grid-cols-4 gap-7 px-8">
          {products.map((p, i) => (
            <ProductCard key={p.id} product={p} priority={i < 2} />
          ))}
        </div>

        <div className="px-5 mt-8 sm:hidden">
          <Link href="/shop" className="btn-outline w-full justify-center">
            See all pieces
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  )
}
