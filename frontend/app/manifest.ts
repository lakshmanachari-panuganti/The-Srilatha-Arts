import type { MetadataRoute } from 'next'

// Required by Next.js 15 + `output: 'export'` — declares this metadata route
// as fully static so it can be emitted as a flat file at build time.
export const dynamic = 'force-static'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'The Srilatha Arts',
    short_name: 'TSA',
    description: 'Where Tradition Meets Creativity — handcrafted art from Hyderabad.',
    start_url: '/',
    display: 'standalone',
    background_color: '#8B3A0E',
    theme_color: '#8B3A0E',
    orientation: 'portrait',
    categories: ['shopping', 'lifestyle', 'art'],
    icons: [
      { src: '/images/logo-round.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/images/logo-round.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/images/logo-round.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
