import type { Metadata, Viewport } from 'next'
import { Playfair_Display, Montserrat, Caveat } from 'next/font/google'
import './globals.css'
import ConditionalLayout from '@/components/ConditionalLayout'
import Providers from '@/components/Providers'

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-playfair',
  display: 'swap',
})

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-montserrat',
  display: 'swap',
})

const caveat = Caveat({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-caveat',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://thesrilathaarts.com'),
  title: {
    default: 'The Srilatha Arts — Where Tradition Meets Creativity',
    template: '%s · The Srilatha Arts',
  },
  description:
    'Bespoke handcrafted Dot Mandala, Resin, Lippan, Pichwai and Kolam art — made by hand in Hyderabad. Free shipping pan-India above ₹2,999.',
  keywords: [
    'Dot Mandala',
    'Resin Art',
    'Lippan Art',
    'Pichwai Art',
    'Kolam Art',
    'Handcrafted Wall Decor',
    'Indian Folk Art',
    'Hyderabad Artist',
  ],
  authors: [{ name: 'Srilatha' }],
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: '/',
    siteName: 'The Srilatha Arts',
    title: 'The Srilatha Arts — Where Tradition Meets Creativity',
    description:
      'Bespoke handcrafted Dot Mandala, Resin, Lippan, Pichwai and Kolam art — made by hand in Hyderabad.',
    images: [
      { url: '/images/logo.png', width: 1200, height: 630, alt: 'The Srilatha Arts' },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Srilatha Arts',
    description: 'Where Tradition Meets Creativity',
    images: ['/images/logo.png'],
  },
  icons: {
    icon: '/images/logo.png',
    apple: '/images/logo.png',
  },
  manifest: '/manifest.webmanifest',
}

export const viewport: Viewport = {
  themeColor: '#2B1E34',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  colorScheme: 'dark',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${playfair.variable} ${montserrat.variable} ${caveat.variable}`}>
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
