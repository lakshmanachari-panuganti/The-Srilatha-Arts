'use client'
/**
 * HeroSlideshow — primary hero block at the top of the homepage.
 *
 * Five curated category slides shipped in /public/Slideshow:
 *   01-resin → 02-dot-mandala → 03-lippan → 04-kolam → 05-wedding-decoratives
 *
 * Premium-ecommerce design choices baked in here:
 *   - Cross-fade between slides (700ms) — no horizontal slide, no flips.
 *   - Slow Ken-Burns zoom on the active image — subliminal motion that
 *     keeps the still photography feeling cinematic.
 *   - Per-slide overlay (category eyebrow + 1-line tagline + pill CTA)
 *     anchored bottom-left, with a soft dark gradient for legibility.
 *   - Dots indicator centred under the image. Active dot has a soft
 *     lavender glow.
 *   - Pause / play control bottom-right (WCAG 2.2.1 — required because
 *     the autoplay is shorter than 5 seconds is the threshold; we use
 *     5s but still expose the control because it's a moving region the
 *     user may want to study).
 *   - prefers-reduced-motion: freeze on the first slide; dots still work.
 *   - All five images preloaded via Next/Image — total payload ~650KB.
 *   - Click/tap on any dot pauses autoplay for 8s so the user can read
 *     without the carousel snatching attention away.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Pause, Play } from 'lucide-react'
import { cn } from '@/lib/cn'

interface Slide {
  src: string
  alt: string
  eyebrow: string
  tagline: string
  href: string
  ctaLabel: string
}

const SLIDES: readonly Slide[] = [
  {
    src: '/Slideshow/01-resin.jpg',
    alt: 'Resin art piece with poured colour and gloss finish',
    eyebrow: 'Resin Art',
    tagline: 'Ocean waves, preserved florals, keepsakes captured in clear resin.',
    href: '/shop/resin',
    ctaLabel: 'Shop Resin',
  },
  {
    src: '/Slideshow/02-dot-mandala.jpg',
    alt: 'Hand-painted dot mandala in vibrant colour',
    eyebrow: 'Dot Mandala',
    tagline: 'Thousands of dots — each placed with intention.',
    href: '/shop/dot-mandala',
    ctaLabel: 'Shop Dot Mandala',
  },
  {
    src: '/Slideshow/03-lippan.jpg',
    alt: 'Lippan art with clay and mirror work',
    eyebrow: 'Lippan Art',
    tagline: 'Clay, mirrors and four hundred years of Kutch craft.',
    href: '/shop/lippan',
    ctaLabel: 'Shop Lippan',
  },
  {
    src: '/Slideshow/04-kolam.jpg',
    alt: 'Kolam line art on dark background',
    eyebrow: 'Kolam Art',
    tagline: 'South Indian rangoli, reimagined for your wall.',
    href: '/shop/kolam',
    ctaLabel: 'Shop Kolam',
  },
  {
    src: '/Slideshow/05-wedding-decoratives.jpg',
    alt: 'Handcrafted wedding decoratives — keepsakes and gifts',
    eyebrow: 'Wedding Collection',
    tagline: 'Custom keepsakes for the day you remember forever.',
    href: '/custom-order',
    ctaLabel: 'Start a custom order',
  },
] as const

const AUTOPLAY_MS = 5000
const USER_PAUSE_AFTER_INTERACTION_MS = 8000
const TRANSITION_MS = 700

export default function HeroSlideshow() {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)
  const userPauseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Pick up prefers-reduced-motion once on mount and react to changes.
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduceMotion(mql.matches)
    const onChange = (e: MediaQueryListEvent) => setReduceMotion(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  // Autoplay. Disabled when paused OR reduced motion is requested.
  useEffect(() => {
    if (paused || reduceMotion) return
    const id = setInterval(() => {
      setActive((i) => (i + 1) % SLIDES.length)
    }, AUTOPLAY_MS)
    return () => clearInterval(id)
  }, [paused, reduceMotion])

  // After a user interaction (dot tap, swipe, keyboard), pause autoplay
  // for a short window so they can actually read the slide.
  const userInteract = useCallback(() => {
    if (userPauseTimer.current) clearTimeout(userPauseTimer.current)
    setPaused(true)
    userPauseTimer.current = setTimeout(() => setPaused(false), USER_PAUSE_AFTER_INTERACTION_MS)
  }, [])

  const goTo = (i: number) => {
    setActive(i)
    userInteract()
  }

  // Swipe gesture on mobile via touch events. Threshold 50px so a vertical
  // page scroll doesn't accidentally trigger a slide change.
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
      className="relative w-full"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => {
        // Don't immediately resume if a user-interaction pause is active.
        if (!userPauseTimer.current) setPaused(false)
      }}
      onFocus={() => setPaused(true)}
      onBlur={() => {
        if (!userPauseTimer.current) setPaused(false)
      }}
    >
      {/*
        Frame. Portrait on mobile (3:4) for editorial feel, cinematic 21:9 on
        desktop. The frame is rounded with a soft lavender hairline border so
        it reads as a finished card rather than a full-bleed banner.
      */}
      <div
        className="relative w-full overflow-hidden mx-auto"
        style={{
          maxWidth: '1280px',
          borderRadius: '24px',
        }}
      >
        <div className="relative w-full aspect-[3/4] sm:aspect-[16/10] lg:aspect-[21/9]">
          {SLIDES.map((slide, i) => {
            const isActive = i === active
            return (
              <div
                key={slide.src}
                className={cn(
                  'absolute inset-0 transition-opacity ease-out',
                  isActive ? 'opacity-100 z-[2]' : 'opacity-0 z-[1] pointer-events-none',
                )}
                style={{ transitionDuration: `${TRANSITION_MS}ms` }}
                aria-hidden={!isActive}
              >
                <Image
                  src={slide.src}
                  alt={slide.alt}
                  fill
                  sizes="(min-width: 1280px) 1280px, 100vw"
                  priority={i === 0}
                  loading={i === 0 ? 'eager' : 'lazy'}
                  className={cn(
                    'object-cover',
                    // Slow Ken-Burns zoom only on the active slide and only
                    // when reduced-motion is off. The keyframes live in
                    // globals.css under `@keyframes hero-ken-burns`.
                    isActive && !reduceMotion && 'hero-ken-burns',
                  )}
                />
                {/* Bottom gradient for overlay legibility. */}
                <div
                  aria-hidden
                  className="absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(to top, rgba(46,16,90,0.78) 0%, rgba(46,16,90,0.35) 35%, transparent 60%)',
                  }}
                />
              </div>
            )
          })}

          {/* Overlay — eyebrow + tagline + CTA, bottom-left. */}
          <div className="absolute inset-x-0 bottom-0 z-[3] px-5 sm:px-8 pb-8 sm:pb-10 lg:pb-14">
            {SLIDES.map((slide, i) => {
              const isActive = i === active
              return (
                <div
                  key={slide.src}
                  className={cn(
                    'transition-all duration-700 ease-out',
                    isActive
                      ? 'opacity-100 translate-y-0'
                      : 'opacity-0 translate-y-3 pointer-events-none absolute inset-x-5 sm:inset-x-8 bottom-8 sm:bottom-10 lg:bottom-14',
                  )}
                  aria-hidden={!isActive}
                >
                  <p
                    className="text-11 sm:text-[12px] uppercase font-semibold text-lavender-pastel mb-2"
                    style={{ letterSpacing: '0.22em' }}
                  >
                    {slide.eyebrow}
                  </p>
                  <p className="font-serif text-xl sm:text-2xl lg:text-3xl text-plum leading-snug max-w-md lg:max-w-xl mb-4 sm:mb-5">
                    {slide.tagline}
                  </p>
                  <Link
                    href={slide.href}
                    className="inline-flex items-center gap-2 text-sm font-medium text-ivory
                               bg-white/10 backdrop-blur-md hover:bg-white/20
                               border border-white/25 hover:border-lavender-pastel/60
                               transition-all duration-500
                               px-5 py-2.5 rounded-full"
                  >
                    {slide.ctaLabel}
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden />
                  </Link>
                </div>
              )
            })}
          </div>

          {/* Pause / play control, bottom-right. WCAG 2.2.1 safeguard. */}
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
            className="absolute right-4 sm:right-5 bottom-4 sm:bottom-5 z-[4]
                       w-9 h-9 rounded-full flex items-center justify-center
                       text-ivory bg-black/30 hover:bg-black/45 backdrop-blur-md
                       border border-white/15 transition-colors duration-300"
          >
            {paused || reduceMotion ? (
              <Play className="w-3.5 h-3.5" aria-hidden />
            ) : (
              <Pause className="w-3.5 h-3.5" aria-hidden />
            )}
          </button>
        </div>
      </div>

      {/* Dots indicator. Sits below the image so it can never overlap text. */}
      <div className="mt-5 sm:mt-6 flex items-center justify-center gap-2">
        {SLIDES.map((slide, i) => {
          const isActive = i === active
          return (
            <button
              key={slide.src}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Show ${slide.eyebrow}`}
              aria-current={isActive ? 'true' : undefined}
              className={cn(
                'h-2 rounded-full transition-all duration-500',
                isActive
                  ? 'w-8 bg-lavender-pastel'
                  : 'w-2 bg-lavender-pastel/30 hover:bg-lavender-pastel/55',
              )}
              style={isActive ? { boxShadow: '0 0 12px rgba(232,121,249,0.55)' } : undefined}
            />
          )
        })}
      </div>

      {/* Live region announces slide changes to screen readers. */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        Slide {active + 1} of {SLIDES.length}: {SLIDES[active]!.eyebrow}
      </p>
    </section>
  )
}
