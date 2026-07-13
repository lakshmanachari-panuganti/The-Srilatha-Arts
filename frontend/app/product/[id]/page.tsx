// Product detail page - pre-rendered at build time for every product that
// exists when the build runs, so static-HTML crawlers (WhatsApp/Facebook/
// Instagram link previews, Bing) see real per-product OG tags instead of the
// generic site metadata.
//
// The '__shell__' fallback is preserved: generateStaticParams always emits it,
// and the staticwebapp.config.json rewrite routes any /product/* URL without a
// pre-rendered page (i.e. products created after the last deploy) to that
// shell. All real data rendering still happens client-side in
// ProductDetailClient via useQuery, so pre-rendered pages self-correct if the
// build-time data has gone stale.
import type { Metadata } from 'next'
import { getAllProducts, getProductById } from '@/data/products'
import ProductDetailClient from './ProductDetailClient'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateStaticParams() {
  try {
    // Build-time catalog fetch. If the API is unreachable (e.g. a local build
    // with no backend running) getAllProducts resolves to [] and we fall back
    // to exactly today's behaviour: a single shell page.
    const products = await getAllProducts()
    return [...products.map((p) => ({ id: p.id })), { id: '__shell__' }]
  } catch {
    return [{ id: '__shell__' }]
  }
}

// Runs at build time only (static export), which is exactly what social
// scrapers need - they read the exported HTML and never execute JS.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  if (id === '__shell__') return {}
  try {
    const product = await getProductById(id)
    if (!product) return {}

    const description = truncate(product.shortDescription || product.description || '', 160)
    const image = product.images?.[0]
    const path = `/product/${id}/`

    return {
      // Root layout template appends ' · Srilatha Art'.
      title: product.title,
      description,
      alternates: { canonical: path },
      openGraph: {
        type: 'website',
        url: path,
        title: product.title,
        description,
        ...(image ? { images: [image] } : {}),
      },
      twitter: {
        card: 'summary_large_image',
        title: product.title,
        description,
        ...(image ? { images: [image] } : {}),
      },
    }
  } catch {
    return {}
  }
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, max - 1).trimEnd()}…`
}

export default function ProductPage() {
  return <ProductDetailClient />
}
