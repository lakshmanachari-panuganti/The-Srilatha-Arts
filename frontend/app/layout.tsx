import type { Metadata, Viewport } from 'next'
import { Square_Peg } from 'next/font/google'
import './globals.css'
import ConditionalLayout from '@/components/ConditionalLayout'
import Providers from '@/components/Providers'

const squarePeg = Square_Peg({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-square-peg',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://srilatha.art'),
  title: {
    default: 'Srilatha Art - Handcrafted with Heart & Soul',
    template: '%s · Srilatha Art',
  },
  description:
    'Resin Art, Lippan Art, Kolam, Wedding Decor and Gift Items — all made by hand in Hyderabad. Free shipping across India on orders above ₹999.',
  keywords: [
    'Resin Art',
    'Lippan Art',
    'Dot Mandala',
    'Kolam Art',
    'Wedding Decor',
    'Lippan Home Decor',
    'Resin Home Decor',
    'Handmade Gifts',
    'Resin Gift Items',
    'Lippan Gift Items',
    'Handmade Indian art',
    'Indian folk art',
    'Hyderabad artist',
  ],
  authors: [{ name: 'Srilatha' }],
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: '/',
    siteName: 'Srilatha Art',
    title: 'Srilatha Art - Handcrafted with Heart & Soul',
    description:
      'Resin, Dot Mandala, Lippan, Kolam and Wedding Decoratives — made one piece at a time.',
    images: [
      { url: '/Logos/logo.png', width: 1200, height: 630, alt: 'Srilatha Art' },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Srilatha Art',
    description: 'Handcrafted with Heart & Soul',
    images: ['/Logos/logo.png'],
  },
  icons: {
    icon: '/Logos/logo.png',
    apple: '/Logos/logo.png',
  },
  manifest: '/manifest.webmanifest',
}

export const viewport: Viewport = {
  themeColor: '#F8F4FF',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  colorScheme: 'light',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${squarePeg.variable}`}>
      <head>
        {/* Preload self-hosted Aldo so the body text doesn't flash in
            Georgia on first paint. next/font handles the preload for
            Square Peg automatically. crossOrigin="anonymous" is required
            even for same-origin font preloads — without it the preload
            and the actual @font-face fetch are considered different
            requests and the cache is missed. */}
        <link
          rel="preload"
          href="/fonts/aldo.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100]
                     focus:bg-lavender-pastel focus:text-plum focus:px-4 focus:py-2 focus:rounded-full"
        >
          Skip to content
        </a>
        <Providers>
          <ConditionalLayout>{children}</ConditionalLayout>
        </Providers>
      </body>
    </html>
  )
}
