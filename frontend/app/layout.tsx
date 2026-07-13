import type { Metadata, Viewport } from 'next'
import { Cormorant_Garamond, DM_Sans, Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import ConditionalLayout from '@/components/ConditionalLayout'
import Providers from '@/components/Providers'
import AnalyticsProvider from '@/components/analytics/AnalyticsProvider'
import { CONTACT } from '@/lib/site-config'

// ── Typography system (AndroAI-inspired canonical) ─────────────────
//   Plus Jakarta Sans - `font-sans` + `font-display`. Body, UI,
//     headlines. Full 400/500/600/700/800 weight range.
//   Cormorant Garamond - `font-serif`. Italic editorial accents only;
//     no longer the default headline face.
//   DM Sans - kept as a system fallback for any legacy callers; can
//     be removed once /theme-preview routes are migrated.
//   Pramukh Rounded - `font-brand`, "Srilatha Art" wordmark only.
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
})

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal'],
  variable: '--font-cormorant',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://www.srilatha.art'),
  title: {
    default: 'Srilatha Art - Handcrafted with Heart & Soul',
    template: '%s · Srilatha Art',
  },
  description:
    'Resin Art, Lippan Art, Kolam, Wedding Decor and Gift Items - all made by hand in Hyderabad. Free shipping across India on qualifying orders.',
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
  themeColor: '#0B1120',
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
      className={`${jakarta.variable} ${cormorant.variable} ${dmSans.variable}`}
    >
      <head>
        {/* Fontshare hosts the Pramukh wordmark face. Open the TLS+TCP +
            DNS connection eagerly so the render-blocking stylesheet
            request below doesn't pay full connection setup on first paint. */}
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="" />
        <link href="https://api.fontshare.com/v2/css?f[]=pramukh-rounded@800&display=swap" rel="stylesheet" />

        {/* Organization + WebSite structured data. Tells Google "this is a
            brand site that sells things and has a search function" - improves
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
                    'Handcrafted resin art, lippan art, dot mandala, kolam art and wedding decoratives - made by hand in Hyderabad, India.',
                  address: {
                    '@type': 'PostalAddress',
                    streetAddress: `${CONTACT.studioAddress.line1}, ${CONTACT.studioAddress.line2}`,
                    addressLocality: CONTACT.studioAddress.city,
                    addressRegion: CONTACT.studioAddress.region,
                    addressCountry: CONTACT.studioAddress.countryCode,
                  },
                  contactPoint: {
                    '@type': 'ContactPoint',
                    contactType: 'customer service',
                    email: CONTACT.email,
                    telephone: CONTACT.phoneTel,
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
                     focus:bg-blue focus:text-white focus:px-4 focus:py-2 focus:rounded-full focus:shadow-lavender-glow"
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
