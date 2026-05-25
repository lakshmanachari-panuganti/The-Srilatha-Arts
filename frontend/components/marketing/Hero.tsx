'use client'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

// Hero is intentionally LIGHTER than before. The visual hero job is now done
// by <HeroSlideshow /> above this component; Hero is the brand-voice block
// that turns the carousel's visual impact into a value proposition. The
// "MADE IN HYDERABAD · SINCE 2020" eyebrow and the big circular SA monogram
// + wordmark were removed deliberately — keep them gone unless the slideshow
// goes away.

export default function Hero() {
  return (
    <section className="relative overflow-hidden flex items-center py-12 sm:py-16 lg:py-24">
      {/* Single ambient glow — the slideshow above provides all the visual
          decoration this hero needs, so the previous 3-orb + mandala setup
          (which existed to halo the monogram) has been removed. */}
      <div
        aria-hidden
        className="absolute -top-20 left-1/2 -translate-x-1/2 w-[400px] h-[280px] rounded-full
                   bg-gradient-to-br from-lavender-pastel/10 to-transparent blur-[80px]"
      />

      <div className="relative max-w-5xl mx-auto px-5 lg:px-8 text-center z-10">
        {/* Headline. No eyebrow + no monogram here — the slideshow above
            already establishes the brand visually. The headline is the
            brand promise that turns the visual impact into intent. */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="display text-4xl sm:text-5xl lg:text-7xl mb-5 lg:mb-7"
        >
          Handmade Indian
          <br />
          art for your{' '}
          <span className="relative italic font-serif">
            <span className="gold-text">home</span>
            <svg
              viewBox="0 0 200 12"
              preserveAspectRatio="none"
              className="absolute -bottom-2 left-0 w-full h-3 text-lavender-soft"
              aria-hidden
            >
              <path
                d="M2 8 Q 50 2, 100 6 T 198 5"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </motion.h1>

        {/* Subhead */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3 }}
          className="text-ivory-soft text-base lg:text-lg max-w-reader mx-auto mb-8 lg:mb-10 leading-relaxed"
        >
          Beautiful wall art in five styles — Resin, Dot Mandala, Lippan, Pichwai and Kolam.
          Each piece is made by hand, one at a time, in our Hyderabad studio.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.45 }}
          className="flex flex-col sm:flex-row gap-3 justify-center mb-14"
        >
          <Link href="/shop" className="btn-dark">
            Shop all art
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
          <Link href="/custom-order" className="btn-outline">
            Order a custom piece
          </Link>
        </motion.div>

        {/* Trust strip — tightened on mobile so the three lines don't
            fragment with stray dot separators (see UI audit §1.8). */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.7 }}
          className="flex flex-col sm:flex-row sm:flex-wrap items-center justify-center
                     gap-y-2 sm:gap-x-6 text-[11px] uppercase text-ivory-mute"
          style={{ letterSpacing: '0.12em' }}
        >
          <span>Free shipping above ₹2,999</span>
          <span className="hidden sm:inline w-1 h-1 rounded-full bg-lavender-soft/40" aria-hidden />
          <span>Made by hand in Hyderabad</span>
          <span className="hidden sm:inline w-1 h-1 rounded-full bg-lavender-soft/40" aria-hidden />
          <span>Delivered in 5–7 days</span>
        </motion.div>
      </div>
    </section>
  )
}
