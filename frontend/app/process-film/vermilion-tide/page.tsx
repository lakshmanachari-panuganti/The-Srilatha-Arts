import type { Metadata } from 'next'
import StandaloneFilm from './StandaloneFilm'

/**
 * Standalone film route — /process-film/vermilion-tide
 *
 * This page is the "Watch the film" surface that opts mobile visitors
 * (and SEO crawlers) into the full chapter-by-chapter video experience.
 * The homepage Room 04 component stays performance-conservative on
 * mobile (poster stills only); visitors who specifically want the
 * cinematic version land here, where videos autoplay on every viewport.
 *
 * Doubles as the SEO landing page for queries like
 * "resin art process" / "how is resin art made" — feeding the funnel
 * with organic search traffic that lands one click from the End Panel
 * ActionPanel (Buy Now / Add to Cart / Inquire).
 */
export const metadata: Metadata = {
  // Root layout template appends ' · Srilatha Art' — don't include the brand
  // here or it ends up twice in the final <title>.
  title: 'The Making of Vermilion Tide — Process Film',
  description:
    'Thirty-two hours of layered resin pour, documented chapter by chapter. Watch the making of Vermilion Tide — handcrafted resin and gold-leaf wall art from the Srilatha Art studio in Hyderabad.',
  alternates: { canonical: '/process-film/vermilion-tide/' },
  openGraph: {
    title: 'The Making of Vermilion Tide',
    description:
      'Thirty-two hours of handcrafted resin art, in five chapters.',
    images: ['/Slideshow/01-resin.jpg'],
    type: 'article',
  },
}

export default function ProcessFilmStandalonePage() {
  return <StandaloneFilm />
}
