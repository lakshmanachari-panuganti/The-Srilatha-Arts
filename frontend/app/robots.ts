import type { MetadataRoute } from 'next'

// Required by Next.js 15 + `output: 'export'` - emit robots.txt at build time.
export const dynamic = 'force-static'

const PROD_HOST = 'https://www.srilatha.art'

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || PROD_HOST
  // The dev SWA (e.g. delightful-mushroom-…azurestaticapps.net) was being
  // crawled and indexed because robots.txt allowed '/'. Force noindex anywhere
  // that isn't the production hostname - pages there carry an env-resolved
  // canonical and we don't want duplicate-content competition with prod.
  const isProd = base === PROD_HOST
  return {
    rules: isProd
      ? [{ userAgent: '*', allow: '/', disallow: ['/admin/', '/account/', '/api/', '/checkout'] }]
      : [{ userAgent: '*', disallow: '/' }],
    sitemap: isProd ? `${base}/sitemap.xml` : undefined,
    host: base,
  }
}
