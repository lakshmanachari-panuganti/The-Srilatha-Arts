import Link from 'next/link'
import PictureImage from '@/components/PictureImage'
import { ArrowRight, Play } from 'lucide-react'

/**
 * Our Story teaser.
 *
 * The visual slot is reserved for a 60-second studio film featuring
 * Srilatha at work (in production - the user will supply the video).
 * Until then, the placeholder below uses one of the real DOT Mandala
 * pieces from /public/category/dot-mandala/ as the still backdrop and
 * overlays a "Studio film · Coming soon" badge + a circular play button.
 *
 * When the film is ready, two changes:
 *   1. Set VIDEO_THUMBNAIL to the new thumbnail jpg (or keep the current
 *      backdrop if you're filming over the same piece).
 *   2. Set VIDEO_URL to a hosted MP4 / YouTube embed URL and wrap the
 *      placeholder in a <video> or <iframe>.
 *
 * Why a circular play button on a placeholder: it signals to a first-time
 * visitor that this surface is about to do more than just sit there.
 * Anticipation is a luxury-brand technique - Aesop and Anthropologie do
 * the same thing for upcoming collections.
 */

const VIDEO_THUMBNAIL = '/category/dot-mandala/29edd2b99f56d8048df6aea5ef22895b.jpg'
// const VIDEO_URL = '' // set when the film is ready

export default function OurStoryTeaser() {
  return (
    <section className="px-5 lg:px-8 py-14 sm:py-20 lg:py-32 max-w-6xl mx-auto">
      <div className="grid lg:grid-cols-12 gap-8 lg:gap-16 items-center">
        {/* Studio film placeholder. Wired as a button so it's keyboard-
            focusable today; will become a real video player when the
            film is ready. */}
        <div className="lg:col-span-6">
          <button
            type="button"
            aria-label="Studio film - coming soon"
            disabled
            className="group relative block w-full aspect-[4/5] overflow-hidden
                       border border-glass-border
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-lavender-pastel/60
                       disabled:cursor-default"
            style={{ borderRadius: '24px' }}
          >
            {/* Backdrop - one of Srilatha's actual pieces, not a logo. */}
            <PictureImage
              src={VIDEO_THUMBNAIL}
              alt="A glimpse of work in the Hyderabad studio"
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover transition-transform duration-1000 ease-out group-hover:scale-[1.03]"
            />

            {/* Soft dark scrim for overlay legibility. */}
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(to top, rgba(20,16,10,0.55) 0%, rgba(20,16,10,0.25) 40%, rgba(20,16,10,0.45) 100%)',
              }}
            />

            {/* Play button - visual anticipation, no actual playback yet. */}
            <span
              aria-hidden
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                         flex items-center justify-center
                         w-20 h-20 sm:w-24 sm:h-24 rounded-full
                         bg-white/15 backdrop-blur-md border border-white/30
                         transition-all duration-500
                         group-hover:bg-white/25 group-hover:scale-105"
              style={{ boxShadow: '0 0 40px rgba(200,150,47,0.30)' }}
            >
              <Play
                className="w-7 h-7 sm:w-8 sm:h-8 text-white"
                fill="white"
                strokeWidth={1}
                aria-hidden
              />
            </span>

            {/* "Coming soon" caption bottom-left. */}
            <span
              className="absolute bottom-5 left-5 inline-flex items-center gap-2
                         px-3 py-1.5 rounded-full
                         bg-black/35 backdrop-blur-md border border-white/15
                         text-[11px] uppercase font-semibold text-ivory"
              style={{ letterSpacing: '0.18em' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-lavender-pastel" />
              Studio film · Coming soon
            </span>
          </button>
        </div>

        <div className="lg:col-span-6 lg:pl-6">
          <p className="eyebrow mb-4">About us</p>
          <h2 className="display text-4xl lg:text-6xl mb-5">
            Made in
            <br />
            <em className="italic">Hyderabad</em>.
          </h2>
          <p className="text-ivory-soft text-base lg:text-lg leading-relaxed mb-4">
            Every piece is made by hand in our small Hyderabad studio. We take our time so each
            artwork comes out exactly right.
          </p>
          <p className="text-ivory-soft text-base lg:text-lg leading-relaxed mb-8">
            Srilatha started painting dot mandalas during the lockdown. Today, she and her small team
            ship handmade art to homes all over India.
          </p>
          <Link href="/our-story" className="btn-link">
            Read our full story
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  )
}
