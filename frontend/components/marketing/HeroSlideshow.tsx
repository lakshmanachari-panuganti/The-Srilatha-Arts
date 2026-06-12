'use client'
/**
 * HomeHero - full-bleed editorial hero.
 *
 * Replaces the prior stacked HeroSlideshow + Hero pair. The slideshow
 * now lives behind a static headline + CTAs (brand promise, not per-slide
 * sells), with a warm ink scrim for legibility. Dots stay for navigation;
 * the per-slide eyebrow/tagline overlay was removed because two competing
 * messages at once (brand promise + category promise) read as noise.
 *
 * Behaviour preserved from both predecessors:
 *   - 5 curated category slides, crossfade, slow Ken-Burns on active.
 *   - 5s autoplay with WCAG-required pause/play control and an
 *     8s user-pause window after any interaction.
 *   - Touch swipe (50px threshold).
 *   - prefers-reduced-motion: freeze on first slide, no zoom, no fade.
 *   - Staggered framer-motion reveal on the centred copy + CTAs.
 *   - Primary "Explore Collections" → /shop, quieter "Or order a
 *     custom piece" → /custom-order, plus trust strip
 *     (Painting since 2020 · Free shipping ₹999 · 7-day returns).
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import PictureImage from '@/components/PictureImage'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Pause, Play } from 'lucide-react'
import { cn } from '@/lib/cn'

interface Slide {
  src: string
  alt: string
  eyebrow: string
}

const SLIDES: readonly Slide[] = [
  { src: '/Slideshow/01-resin.jpg',               alt: 'Resin art piece with poured colour and gloss finish',     eyebrow: 'Resin Art' },
  { src: '/Slideshow/02-dot-mandala.jpg',         alt: 'Hand-painted dot mandala in vibrant colour',              eyebrow: 'Dot Mandala' },
  { src: '/Slideshow/03-lippan.jpg',              alt: 'Lippan art with clay and mirror work',                    eyebrow: 'Lippan Art' },
  { src: '/Slideshow/04-kolam.jpg',               alt: 'Kolam line art on dark background',                       eyebrow: 'Kolam Art' },
  { src: '/Slideshow/05-wedding-decoratives.jpg', alt: 'Handcrafted wedding decoratives - keepsakes and gifts',   eyebrow: 'Wedding Collection' },
] as const

const AUTOPLAY_MS = 5000
const USER_PAUSE_AFTER_INTERACTION_MS = 8000
const TRANSITION_MS = 700

export default function HomeHero() {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)
  const userPauseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduceMotion(mql.matches)
    const onChange = (e: MediaQueryListEvent) => setReduceMotion(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (paused || reduceMotion) return
    const id = setInterval(() => {
      setActive((i) => (i + 1) % SLIDES.length)
    }, AUTOPLAY_MS)
    return () => clearInterval(id)
  }, [paused, reduceMotion])

  const userInteract = useCallback(() => {
    if (userPauseTimer.current) clearTimeout(userPauseTimer.current)
    setPaused(true)
    userPauseTimer.current = setTimeout(() => setPaused(false), USER_PAUSE_AFTER_INTERACTION_MS)
  }, [])

  const goTo = (i: number) => {
    setActive(i)
    userInteract()
  }

  const touchStartX = useRef<number | null>(null)
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current
    const delta = endX - touchStartX.current
    touchStartX.current = null
    if (Math.abs(delta) < 50) return
    if (delta < 0) goTo((active + 1) % SLIDES.length)
    else goTo((active - 1 + SLIDES.length) % SLIDES.length)
  }

  return (
    <section
      aria-label="Featured collections"
      className="relative w-full overflow-hidden"
      style={{ height: '100svh', minHeight: '600px', maxHeight: '900px' }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Slide layers. Each fills the section; crossfade by toggling opacity. */}
      {SLIDES.map((slide, i) => {
        const isActive = i === active
        return (
          <div
            key={slide.src}
            className={cn(
              'absolute inset-0 transition-opacity ease-out',
              isActive ? 'opacity-100 z-[1]' : 'opacity-0 z-0 pointer-events-none',
            )}
            style={{ transitionDuration: `${TRANSITION_MS}ms` }}
            aria-hidden={!isActive}
          >
            <PictureImage
              src={slide.src}
              alt={slide.alt}
              fill
              sizes="100vw"
              priority={i === 0}
              loading={i === 0 ? 'eager' : 'lazy'}
              className={cn(
                'object-cover',
                isActive && !reduceMotion && 'hero-ken-burns',
              )}
            />
          </div>
        )
      })}

      {/* Warm ink scrim - diagonal so the photograph still breathes on the
          right while text on the left/centre stays legible, plus a soft
          top-down wash so the fixed Header's ivory-tinted glyphs have a
          dark backing while the user is at scroll position 0. Ink-toned
          rather than generic black so it sits inside the ivory/ink palette. */}
      <div
        aria-hidden
        className="absolute inset-0 z-[2]"
        style={{
          background:
            'linear-gradient(180deg, rgba(20,16,10,0.55) 0%, rgba(20,16,10,0.20) 18%, transparent 32%), linear-gradient(105deg, rgba(20,16,10,0.78) 0%, rgba(20,16,10,0.55) 35%, rgba(20,16,10,0.25) 65%, transparent 100%), linear-gradient(to top, rgba(20,16,10,0.55) 0%, transparent 50%)',
        }}
      />

      {/* Centred copy + CTAs. Max-w keeps the headline from sprawling on
          wide desktops; padding bottom leaves room for dots. */}
      <div className="relative z-[3] h-full flex items-center">
        <div className="w-full max-w-5xl mx-auto px-5 sm:px-8 lg:px-12 pb-20 sm:pb-24">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="eyebrow text-on-dark-accent mb-4"
          >
            {SLIDES[active]!.eyebrow}
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="display text-4xl sm:text-6xl lg:text-7xl xl:text-8xl uppercase text-white mb-6 max-w-3xl"
            style={{ textShadow: '0 2px 14px rgba(0,0,0,0.35)' }}
          >
            Premium Handcrafted
            <br />
            Art for Your{' '}
            <span className="relative italic font-serif font-medium gold-text">
              Home
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.3 }}
            className="text-base sm:text-lg lg:text-xl text-white/85 leading-relaxed max-w-2xl mb-8"
            style={{ textShadow: '0 1px 8px rgba(0,0,0,0.35)' }}
          >
            Specializing in handcrafted Resin Art, traditional Lippan Art, and elegant Home &amp; Wedding Decor.
            Hand-painted, hand-poured, and shockproof-shipped from Hyderabad to elevate your space.
          </motion.p>

          {/* CTA cluster — sits inside a soft warmglow-dark focal panel so
              the buttons read as a single spotlight against the slideshow
              scrim. Primary uses the gold-halo pill; secondary picks up
              the same halo on hover instead of staying a plain underline. */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.45 }}
            className="card-warmglow-dark inline-flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 sm:p-4 mb-10 w-full sm:w-auto"
          >
            <Link
              href="/shop"
              className="btn-glow-gold inline-flex items-center justify-center gap-2 min-h-12 px-7 text-sm uppercase tracking-wide w-full sm:w-auto sm:min-w-[16rem] active:scale-[0.98]"
            >
              Explore Collections
              <ArrowRight className="w-4 h-4" aria-hidden />
            </Link>
            <Link
              href="/custom-order"
              className="btn-glow-gold-outline inline-flex items-center justify-center gap-2 min-h-12 px-6 text-sm uppercase tracking-wide w-full sm:w-auto"
            >
              Order a custom piece
              <ArrowRight className="w-3.5 h-3.5" aria-hidden />
            </Link>
          </motion.div>

          {/* Trust strip - concrete signals, dot separators on ≥sm. */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.7 }}
            className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center
                       gap-y-2 sm:gap-x-5 text-xs sm:text-[11px] uppercase text-white/70"
            style={{ letterSpacing: '0.08em' }}
          >
            <span>Painting since 2020</span>
            <span className="hidden sm:inline w-1 h-1 rounded-full bg-white/40" aria-hidden />
            <span>Free shipping above ₹999</span>
            <span className="hidden sm:inline w-1 h-1 rounded-full bg-white/40" aria-hidden />
            <span>7-day easy returns</span>
          </motion.div>
        </div>
      </div>

      {/* Dots indicator. Sits over the image at the bottom centre - large
          enough on mobile to be a real tap target (44×44 hit area via
          generous padding on the wrapping button). */}
      <div className="absolute inset-x-0 bottom-6 sm:bottom-8 z-[4] flex items-center justify-center gap-2">
        {SLIDES.map((slide, i) => {
          const isActive = i === active
          return (
            <button
              key={slide.src}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Show ${slide.eyebrow}`}
              aria-current={isActive ? 'true' : undefined}
              className="p-3 -m-3"
            >
              <span
                aria-hidden
                className={cn(
                  'block h-2 rounded-full transition-all duration-500',
                  isActive ? 'w-8 bg-white' : 'w-2 bg-white/45 hover:bg-white/70',
                )}
              />
            </button>
          )
        })}
      </div>

      {/* Pause / play. WCAG 2.2.1 - autoplay must be pause-able. */}
      <button
        type="button"
        onClick={() => {
          if (userPauseTimer.current) {
            clearTimeout(userPauseTimer.current)
            userPauseTimer.current = null
          }
          setPaused((p) => !p)
        }}
        aria-label={paused ? 'Resume slideshow' : 'Pause slideshow'}
        className="absolute right-4 sm:right-6 bottom-4 sm:bottom-6 z-[5]
                   min-w-11 min-h-11 w-11 h-11 rounded-full flex items-center justify-center
                   text-white bg-black/35 hover:bg-black/55
                   border border-white/20 transition-colors duration-300"
      >
        {paused || reduceMotion ? (
          <Play className="w-4 h-4" aria-hidden />
        ) : (
          <Pause className="w-4 h-4" aria-hidden />
        )}
      </button>

      {/* Live region announces slide changes to screen readers. */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        Slide {active + 1} of {SLIDES.length}: {SLIDES[active]!.eyebrow}
      </p>
    </section>
  )
}
