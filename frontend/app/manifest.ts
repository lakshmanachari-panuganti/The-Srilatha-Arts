import type { MetadataRoute } from 'next'

// Required by Next.js 15 + `output: 'export'` - declares this metadata route
// as fully static so it can be emitted as a flat file at build time.
export const dynamic = 'force-static'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Srilatha Art',
    short_name: 'Srilatha Art',
    description: 'Resin Art, Lippan Art, Wedding Decor and Handmade Gifts - made by hand in Hyderabad.',
    start_url: '/',
    display: 'standalone',
    background_color: '#07080a',
    theme_color: '#07080a',
    orientation: 'portrait',
    categories: ['shopping', 'lifestyle', 'art'],
    icons: [
      { src: '/Logos/pwa-192.png',          sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/Logos/pwa-512.png',          sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/Logos/pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
