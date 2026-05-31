import type { MetadataRoute } from 'next'

// Required by Next.js 15 + `output: 'export'` - declares this metadata route
// as fully static so it can be emitted as a flat file at build time.
export const dynamic = 'force-static'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Srilatha Art',
    short_name: 'Srilatha Art',
    description: 'Resin Art, Lippan Art, Wedding Decor and Handmade Gifts — made by hand in Hyderabad.',
    start_url: '/',
    display: 'standalone',
    background_color: '#FAF6EE',
    theme_color: '#FAF6EE',
    orientation: 'portrait',
    categories: ['shopping', 'lifestyle', 'art'],
    icons: [
      { src: '/Logos/logo.png', sizes: '192x192', type: 'image/jpeg', purpose: 'any' },
      { src: '/Logos/logo.png', sizes: '512x512', type: 'image/jpeg', purpose: 'any' },
      { src: '/Logos/logo.png', sizes: '512x512', type: 'image/jpeg', purpose: 'maskable' },
    ],
  }
}
