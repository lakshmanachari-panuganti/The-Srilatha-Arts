'use client'
/**
 * HomeHero — pure-black editorial hero, single-screen, no slideshow.
 *
 * Reference: Apple-style "Brilliant. In every way." composition. Pure
 * black canvas, sharp sans display headline, two CTAs (primary gold
 * pill + secondary outline), minimal social row pinned to the bottom-
 * left. Restraint by design — the chrome disappears so the brand
 * promise carries the entire above-the-fold.
 *
 * Replaces the prior 5-slide auto-rotating slideshow per the user's
 * 2026-06-12 redesign brief. The slideshow's responsibilities — slide
 * eyebrow, trust strip, dots indicator, pause/play, autoplay timer,
 * touch swipe — are all gone. Featured artwork moves to the section
 * below (FeaturedCreations / BestSellers).
 *
 * a11y notes:
 *   - One <section aria-label> at root for landmark naming.
 *   - The headline is the only h1 on the page.
 *   - prefers-reduced-motion freezes the staggered reveal.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

export default function HomeHero() {
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduceMotion(mql.matches)
    const onChange = (e: MediaQueryListEvent) => setReduceMotion(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  const fadeIn = (delay: number) =>
    reduceMotion
      ? { initial: { opacity: 1 }, animate: { opacity: 1 } }
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.9, delay, ease: [0.25, 0.46, 0.45, 0.94] as const },
        }

  return (
    <section
      aria-label="Welcome to Srilatha Art"
      className="relative w-full overflow-hidden"
      style={{
        height: '100svh',
        minHeight: '600px',
        maxHeight: '900px',
        background: '#000000',
      }}
    >
      {/* Soft top vignette — gives the fixed Header glyphs a near-black
          backing without painting a hard band across the canvas. */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-40 z-[1]"
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.40) 60%, transparent 100%)',
        }}
      />

      {/* Editorial content column — left-aligned on desktop, centred-left
          on mobile. Generous breathing room above and below; the headline
          does the work, no decorative chrome. */}
      <div className="relative z-[2] h-full flex items-center">
        <div className="w-full max-w-7xl mx-auto px-5 sm:px-8 lg:px-16 pb-24 sm:pb-28">
          <div className="max-w-3xl">
            <motion.h1
              {...fadeIn(0.05)}
              className="display text-white font-sans font-semibold uppercase
                         text-5xl sm:text-7xl lg:text-8xl xl:text-[7.5rem]
                         leading-[1.02] tracking-[-0.02em] mb-6"
              style={{
                // Override the global h1 readability shield — pure black
                // canvas + crisp white type doesn't need it, and the
                // shadow softens the edges we want crisp here.
                textShadow: 'none',
              }}
            >
              Handcrafted.
              <br />
              One hand, one piece
              <br />
              at a time<span style={{ color: 'var(--accent-gold)' }}>.</span>
            </motion.h1>

            <motion.p
              {...fadeIn(0.20)}
              className="text-base sm:text-lg max-w-xl mb-10 leading-relaxed"
              style={{ color: 'rgba(255,255,255,0.65)' }}
            >
              Each piece is hand-painted in our Hyderabad studio.
            </motion.p>

            <motion.div
              {...fadeIn(0.32)}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4"
            >
              <Link
                href="/shop"
                className="btn-glow-gold min-w-0 sm:min-w-[15rem] justify-center"
              >
                Explore Collections
                <ArrowRight className="w-4 h-4" aria-hidden />
              </Link>
              <Link
                href="/custom-order"
                className="btn-glow-gold-outline justify-center"
              >
                Order a custom piece
                <ArrowRight className="w-3.5 h-3.5" aria-hidden />
              </Link>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Bottom-left social row — small caps, hairline separators. Same
          editorial rhythm as the reference's "01/04 · FACEBOOK ·
          INSTAGRAM · TWITTER" footer. */}
      <motion.div
        {...fadeIn(0.50)}
        aria-label="Follow Srilatha Art"
        className="absolute bottom-6 sm:bottom-8 left-5 sm:left-8 lg:left-16 z-[2]
                   flex items-center gap-3 sm:gap-5 text-[10px] sm:text-[11px]
                   uppercase font-medium"
        style={{ letterSpacing: '0.18em', color: 'rgba(255,255,255,0.45)' }}
      >
        <a
          href="https://wa.me/919133266754"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors duration-300 hover:text-white"
        >
          WhatsApp
        </a>
        <span className="w-1 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.30)' }} aria-hidden />
        <a
          href="https://instagram.com/srilatha_arts"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors duration-300 hover:text-white"
        >
          Instagram
        </a>
        <span className="w-1 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.30)' }} aria-hidden />
        <span className="hidden sm:inline" style={{ color: 'rgba(255,255,255,0.30)' }}>
          Painting since 2020
        </span>
      </motion.div>
    </section>
  )
}
