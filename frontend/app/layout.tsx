import type { Metadata, Viewport } from 'next'
import { Square_Peg, Cormorant_Garamond, DM_Sans } from 'next/font/google'
import './globals.css'
import ConditionalLayout from '@/components/ConditionalLayout'
import Providers from '@/components/Providers'

// ── Typography system ──────────────────────────────────────────────
// Three Google fonts, each with a clear role. next/font self-hosts at
// build time, generates fallback metrics to prevent layout shift, and
// inlines the CSS — no runtime CDN hit, no FOUT beyond the swap.
//
//   Cormorant Garamond — `font-serif`. Display + headlines. Variable
//     weight range with elegant high-contrast capitals (the previous
//     Aldo face was a single-weight script that produced faux-bold
//     under font-semibold/bold and looked stiff under uppercase, which
//     this site uses heavily for h1/h2 + buttons + nav + eyebrows).
//
//   DM Sans — `font-sans`. Body, UI, prices, buttons. Variable weight,
//     proper hinting at small sizes.
//
//   Square Peg — `font-brand`. Reserved for the "Srilatha Art"
//     wordmark only. Don't use it elsewhere.
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
})

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
    <html
      lang="en-IN"
      className={`${cormorant.variable} ${dmSans.variable} ${squarePeg.variable}`}
    >
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
