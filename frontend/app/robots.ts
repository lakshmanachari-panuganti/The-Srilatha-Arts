import type { MetadataRoute } from 'next'

// Required by Next.js 15 + `output: 'export'` - emit robots.txt at build time.
export const dynamic = 'force-static'

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.srilatha.art'
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/admin/', '/account/', '/api/', '/checkout'] },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
