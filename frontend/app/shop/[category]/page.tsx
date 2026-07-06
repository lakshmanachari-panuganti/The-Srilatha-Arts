import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import CategoryChips from '@/components/shop/CategoryChips'
import ProductListClient from '@/components/shop/ProductListClient'
import { CATEGORY_BY_SLUG, CATEGORIES } from '@/data/categories'

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
  // Root layout template appends ' · Srilatha Art' - return just the category
  // title here to avoid the brand suffix appearing twice in the final <title>.
  // Per-collection description uses `origin` (2-3 sentences) instead of the
  // one-line `tagline` so each collection has unique, keyword-rich metadata.
  const description = cat.origin
  return {
    title: cat.title,
    description,
    alternates: { canonical: `/shop/${cat.slug}/` },
    openGraph: {
      title: `${cat.title} - Srilatha Art`,
      description,
      url: `/shop/${cat.slug}/`,
      images: [{ url: cat.heroImage, alt: cat.title }],
    },
    twitter: {
      title: `${cat.title} - Srilatha Art`,
      description,
      images: [cat.heroImage],
    },
  }
}

export default async function ShopCategoryPage({ params }: Props) {
  const { category } = await params
  const cat = CATEGORY_BY_SLUG[category]
  if (!cat) notFound()

  return (
    <>
      <CategoryChips />
      <header className="px-5 lg:px-8 pt-12 lg:pt-20 pb-8 lg:pb-14 max-w-6xl mx-auto">
        <p className="eyebrow mb-4">
          <span className="section-no text-lavender">
            {String(cat.ordinal).padStart(3, '0')}
          </span>
          Shop by style
        </p>
        <h1 className="display text-4xl md:text-5xl lg:text-7xl mb-5">
          {cat.title.split(' ').slice(0, -1).join(' ')}{' '}
          <em className="italic">{cat.title.split(' ').slice(-1)}</em>
        </h1>
        <p className="text-ink-soft max-w-xl leading-relaxed text-base lg:text-lg mb-3">
          {cat.origin}
        </p>
        <p className="text-ink-mute text-sm">
          <Link href="/the-craft" className="text-lavender hover:underline">
            See how it&apos;s made
          </Link>
        </p>
      </header>

      <div className="max-w-6xl mx-auto py-6 lg:py-10">
        <ProductListClient category={category} showCount />
      </div>
    </>
  )
}
