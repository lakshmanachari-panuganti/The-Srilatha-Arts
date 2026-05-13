import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import CategoryChips from '@/components/shop/CategoryChips'
import ProductGrid from '@/components/shop/ProductGrid'
import { CATEGORY_BY_SLUG, CATEGORIES } from '@/data/categories'
import { getProductsByCategory } from '@/data/products'

interface Props {
  params: Promise<{ category: string }>
}

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ category: c.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params
  const cat = CATEGORY_BY_SLUG[category]
  if (!cat) return { title: 'Not found' }
  return {
    title: `${cat.title} · The Srilatha Arts`,
    description: cat.tagline,
  }
}

export default async function ShopCategoryPage({ params }: Props) {
  const { category } = await params
  const cat = CATEGORY_BY_SLUG[category]
  if (!cat) notFound()

  const products = await getProductsByCategory(category)

  return (
    <>
      <CategoryChips />
      <header className="px-5 lg:px-8 pt-12 lg:pt-20 pb-8 lg:pb-14 max-w-6xl mx-auto">
        <p className="eyebrow mb-4">
          <span className="section-no text-terracotta">
            {String(cat.ordinal).padStart(3, '0')}
          </span>
          The collection
        </p>
        <h1 className="display text-4xl md:text-5xl lg:text-7xl mb-5">
          {cat.title.split(' ').slice(0, -1).join(' ')}{' '}
          <em className="italic">{cat.title.split(' ').slice(-1)}</em>
        </h1>
        <p className="text-ink-soft max-w-xl leading-relaxed text-base lg:text-lg mb-3">
          {cat.origin}
        </p>
        <p className="text-ink-mute text-sm">
          {products.length} {products.length === 1 ? 'piece' : 'pieces'} ·{' '}
          <Link href="/the-craft" className="text-terracotta hover:underline">
            learn how it&apos;s made
          </Link>
        </p>
      </header>

      <div className="max-w-6xl mx-auto py-6 lg:py-10">
        <ProductGrid products={products} />
      </div>
    </>
  )
}
