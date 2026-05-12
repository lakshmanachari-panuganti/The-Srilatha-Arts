import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import CategoryChips from '@/components/shop/CategoryChips'
import ProductGrid from '@/components/shop/ProductGrid'
import { CATEGORY_BY_SLUG, CATEGORIES } from '@/data/categories'
import { getProductsByCategory } from '@/data/products'

interface PageProps {
  params: Promise<{ category: string }>
}

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ category: c.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category } = await params
  const cat = CATEGORY_BY_SLUG[category]
  if (!cat) return { title: 'Not found' }
  return {
    title: `${cat.title} · Handcrafted ${cat.title}`,
    description: cat.origin,
  }
}

export default async function CategoryPage({ params }: PageProps) {
  const { category } = await params
  const cat = CATEGORY_BY_SLUG[category]
  if (!cat) notFound()

  const products = getProductsByCategory(cat.slug)

  return (
    <>
      <CategoryChips />
      <header className="relative px-5 lg:px-8 pt-8 lg:pt-16 pb-6 lg:pb-12 max-w-7xl mx-auto">
        <p className="text-[11px] uppercase tracking-[0.3em] text-gold-light/70 mb-2">
          The Srilatha Arts presents
        </p>
        <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl text-cream mb-3">
          {cat.title.split(' ').slice(0, -1).join(' ')}{' '}
          <span className="gold-text">{cat.title.split(' ').slice(-1)}</span>
        </h1>
        <p className="text-cream/70 max-w-xl leading-relaxed mb-2">{cat.origin}</p>
        <p className="text-cream/45 text-sm">
          {products.length} {products.length === 1 ? 'piece' : 'pieces'} ·{' '}
          <Link href="/the-craft" className="text-gold hover:underline">
            learn how it&apos;s made
          </Link>
        </p>
      </header>

      <div className="max-w-7xl mx-auto py-4 lg:py-8">
        <ProductGrid products={products} />
      </div>
    </>
  )
}
