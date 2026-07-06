'use client'
import Link from 'next/link'
import PictureImage from '@/components/PictureImage'
import { ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'

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

const ART_IMAGE = '/category/dot-mandala/29edd2b99f56d8048df6aea5ef22895b.jpg'

export default function OurStoryTeaser() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="px-5 lg:px-8 py-14 sm:py-20 lg:py-32 max-w-6xl mx-auto"
    >
      <div className="grid lg:grid-cols-12 gap-8 lg:gap-16 items-center">
        {/* Editorial art image - full-bleed with a warm scrim */}
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="lg:col-span-6"
        >
          <div
            className="group relative block w-full aspect-[4/5] overflow-hidden border border-glass-border"
            style={{ borderRadius: '24px' }}
          >
            <PictureImage
              src={ART_IMAGE}
              alt="A dot mandala created in the Srilatha Art studio, Hyderabad"
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover transition-transform duration-1000 ease-out group-hover:scale-[1.03]"
            />
            {/* Warm scrim for bottom overlay legibility */}
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(to top, rgba(7,8,10,0.70) 0%, rgba(7,8,10,0.25) 40%, transparent 70%)',
              }}
            />
            {/* Studio location badge */}
            <span
              className="absolute bottom-5 left-5 inline-flex items-center gap-2
                         px-3 py-1.5 rounded-full
                         bg-black/35 backdrop-blur-md border border-white/15
                         text-[11px] uppercase font-semibold text-ivory"
              style={{ letterSpacing: '0.18em' }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: 'var(--accent)' }}
              />
              Handmade in Hyderabad
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, delay: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="lg:col-span-6 lg:pl-6"
        >
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
        </motion.div>
      </div>
    </motion.section>
  )
}
