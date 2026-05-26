import type { Metadata, Viewport } from 'next'
import { Playfair_Display, Montserrat } from 'next/font/google'
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

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://srilatha.art'),
  title: {
    default: 'Srilatha Art - Handcrafted with Heart & Soul',
    template: '%s · Srilatha Art',
  },
  description:
    'Handmade Indian art — Resin, Dot Mandala, Lippan, Kolam and Wedding Decoratives. Free shipping across India on orders above ₹2,999.',
  keywords: [
    'Dot Mandala',
    'Resin Art',
    'Lippan Art',
    'Kolam Art',
    'Wedding Decoratives',
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
      { url: '/Logos/logo.jpeg', width: 1200, height: 630, alt: 'Srilatha Art' },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Srilatha Art',
    description: 'Handcrafted with Heart & Soul',
    images: ['/Logos/logo.jpeg'],
  },
  icons: {
    icon: '/Logos/logo.jpeg',
    apple: '/Logos/logo.jpeg',
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
    <html lang="en-IN" className={`${playfair.variable} ${montserrat.variable}`}>
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
