import type { Metadata, Viewport } from 'next'
import { Cormorant_Garamond, DM_Sans, Fraunces, Italianno } from 'next/font/google'
import './globals.css'
import ConditionalLayout from '@/components/ConditionalLayout'
import Providers from '@/components/Providers'
import AnalyticsProvider from '@/components/analytics/AnalyticsProvider'

// ── Typography system ──────────────────────────────────────────────
// Three Google fonts, each with a clear role. next/font self-hosts at
// build time, generates fallback metrics to prevent layout shift, and
// inlines the CSS - no runtime CDN hit, no FOUT beyond the swap.
//
//   Cormorant Garamond - `font-serif`. Display + headlines. Variable
//     weight range with elegant high-contrast capitals (the previous
//     Aldo face was a single-weight script that produced faux-bold
//     under font-semibold/bold and looked stiff under uppercase, which
//     this site uses heavily for h1/h2 + buttons + nav + eyebrows).
//
//   DM Sans - `font-sans`. Body, UI, prices, buttons. Variable weight,
//     proper hinting at small sizes.
//
//   Pramukh Rounded - `font-brand`. Reserved for the "Srilatha Art"
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

// Fraunces — modern variable serif used by Aman / Are.na / Helvetiq.
// Scoped to a single non-hero surface (kept loaded as a fallback so
// any inline opt-in still resolves without a network re-fetch). Tight
// weight set keeps the payload small.
const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  style: ['normal'],
  variable: '--font-fraunces',
  display: 'swap',
})

// Italianno — flowing cursive script used on the homepage hero h1
// (per user reference "Angela White"). Italianno is single-weight
// (400) — typical of script faces.
const italianno = Italianno({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-italianno',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://www.srilatha.art'),
  title: {
    default: 'Srilatha Art - Handcrafted with Heart & Soul',
    template: '%s · Srilatha Art',
  },
  description:
    'Resin Art, Lippan Art, Kolam, Wedding Decor and Gift Items - all made by hand in Hyderabad. Free shipping across India on orders above ₹999.',
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
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: '/',
    siteName: 'Srilatha Art',
    title: 'Srilatha Art - Handcrafted with Heart & Soul',
    description:
      'Resin, Dot Mandala, Lippan, Kolam and Wedding Decoratives - made one piece at a time.',
    images: [
      { url: '/Logos/og-cover.jpg', width: 1200, height: 630, alt: 'Srilatha Art' },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Srilatha Art',
    description: 'Handcrafted with Heart & Soul',
    images: ['/Logos/og-cover.jpg'],
  },
  icons: {
    icon: [
      { url: '/Logos/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/Logos/pwa-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: { url: '/Logos/favicon-180.png', sizes: '180x180', type: 'image/png' },
  },
  manifest: '/manifest.webmanifest',
}

export const viewport: Viewport = {
  themeColor: '#07080a',
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
      className={`${cormorant.variable} ${dmSans.variable} ${fraunces.variable} ${italianno.variable}`}
    >
      <head>
        {/* Fontshare hosts the Pramukh wordmark face. Open the TLS+TCP +
            DNS connection eagerly so the render-blocking stylesheet
            request below doesn't pay full connection setup on first paint. */}
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="" />
        <link href="https://api.fontshare.com/v2/css?f[]=pramukh-rounded@800&display=swap" rel="stylesheet" />

        {/* Organization + WebSite structured data. Tells Google "this is a
            brand site that sells things and has a search function" — improves
            knowledge-panel eligibility and sitelinks search box. Per-product
            Product+Offer JSON-LD is injected separately in ProductDetailClient
            once product data resolves. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': 'Organization',
                  '@id': 'https://www.srilatha.art/#organization',
                  name: 'Srilatha Art',
                  url: 'https://www.srilatha.art',
                  logo: 'https://www.srilatha.art/Logos/pwa-512.png',
                  description:
                    'Handcrafted resin art, lippan art, dot mandala, kolam art and wedding decoratives — made by hand in Hyderabad, India.',
                  address: {
                    '@type': 'PostalAddress',
                    addressLocality: 'Hyderabad',
                    addressRegion: 'Telangana',
                    addressCountry: 'IN',
                  },
                  contactPoint: {
                    '@type': 'ContactPoint',
                    contactType: 'customer service',
                    email: 'studio@srilatha.art',
                    telephone: '+91-91332-66754',
                    areaServed: 'IN',
                    availableLanguage: ['en', 'hi', 'te'],
                  },
                },
                {
                  '@type': 'WebSite',
                  '@id': 'https://www.srilatha.art/#website',
                  url: 'https://www.srilatha.art',
                  name: 'Srilatha Art',
                  publisher: { '@id': 'https://www.srilatha.art/#organization' },
                  inLanguage: 'en-IN',
                  potentialAction: {
                    '@type': 'SearchAction',
                    target: {
                      '@type': 'EntryPoint',
                      urlTemplate: 'https://www.srilatha.art/shop?q={search_term_string}',
                    },
                    'query-input': 'required name=search_term_string',
                  },
                },
              ],
            }),
          }}
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
          <AnalyticsProvider />
        </Providers>
      </body>
    </html>
  )
}
