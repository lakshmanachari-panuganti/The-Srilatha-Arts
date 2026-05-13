import type { MetadataRoute } from 'next'
import { CATEGORIES } from '@/data/categories'
import { getAllProducts } from '@/data/products'

// Required by Next.js 15 + `output: 'export'` - emit sitemap.xml at build time.
export const dynamic = 'force-static'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getAllProducts()
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://thesrilathaarts.com'
  const now = new Date()

  const staticRoutes = [
    '',
    '/shop',
    '/new-arrivals',
    '/best-sellers',
    '/sale',
    '/custom-order',
    '/our-story',
    '/care-guide',
    '/reviews',
    '/faq',
    '/contact',
    '/shipping-and-returns',
    '/privacy-policy',
    '/terms',
  ].map((path) => ({
    url: `${base}${path || '/'}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: path === '' ? 1 : 0.7,
  }))

  const categoryRoutes = CATEGORIES.map((c) => ({
    url: `${base}/shop/${c.slug}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  const productRoutes = products.map((p) => ({
    url: `${base}/product/${p.id}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }))

  return [...staticRoutes, ...categoryRoutes, ...productRoutes]
}
