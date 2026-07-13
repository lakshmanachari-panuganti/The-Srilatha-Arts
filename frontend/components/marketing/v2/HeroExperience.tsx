'use client'

/**
 * HeroExperience - Room 01 of the "Studio Vault" redesign.
 *
 * Editorial split hero, museum-catalog grammar:
 *   - Left half: numbered exhibition eyebrow → display headline →
 *     editorial lede → 3 CTAs (primary resin button + 2 editorial links).
 *   - Right half: the artwork "plate" - a single piece per slide, mounted
 *     like a gallery print. Rotates through 4 works every ~7s with a
 *     vertical clip-path wipe. The plate carries the signature
 *     "Liquid Resin Shine":
 *       · animated diagonal sheen (.resin-plate::after)
 *       · top-edge specular highlight (.resin-plate::before)
 *       · cursor-reactive radial highlight (.resin-specular, driven by
 *         --rx/--ry custom properties; on mobile, gyroscope tilt drives
 *         the same vars).
 *   - Backdrop: KolamCursorField - a live dot-lace pattern the cursor
 *     "draws" gold through. Sits at the back of the section, low
 *     opacity, breathes when idle.
 *   - Top-right: hand-numbered "00 / 04" exhibition counter.
 *   - Bottom: full-width museum caption strip - title · dimensions ·
 *     medium · year - like a real gallery wall card.
 *
 * The page-level header sits over this section as it does for the old
 * HeroSlideshow; the warm scrim under the header is preserved via the
 * top-corner gradient inside the left column. No layout offset needed
 * at the consumer level beyond the existing `-mt-20 lg:-mt-28` wrap.
 *
 * Drop-in: import this in app/page.tsx in place of HeroSlideshow. The
 * existing HeroSlideshow remains in place; this lives in v2/.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import PictureImage from '@/components/PictureImage'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, MessageCircle } from 'lucide-react'
import KolamCursorField from './KolamCursorField'
import { waLink } from '@/lib/site-config'

interface ArtworkSlide {
  src: string
  alt: string
  title: string
  medium: string
  dimensions: string
  year: string
}

const SLIDES: readonly ArtworkSlide[] = [
  {
    src: '/Slideshow/01-resin.jpg',
    alt: 'Vermilion Tide - resin and gold-leaf wall piece',
    title: 'Vermilion Tide',
    medium: 'Resin & gold leaf on birch panel',
    dimensions: '22 × 30 in',
    year: '2026',
  },
  {
    src: '/Slideshow/02-dot-mandala.jpg',
    alt: 'Concentric Devotion - hand-painted dot mandala',
    title: 'Concentric Devotion',
    medium: 'Acrylic & ink on canvas',
    dimensions: '24 × 24 in',
    year: '2025',
  },
  {
    src: '/Slideshow/03-lippan.jpg',
    alt: 'Mirror Garden - lippan clay and mirror work',
    title: 'Mirror Garden',
    medium: 'Lippan clay & hand-cut mirror',
    dimensions: '18 × 24 in',
    year: '2025',
  },
  {
    src: '/Slideshow/04-kolam.jpg',
    alt: 'White Threshold - single-stroke kolam study',
    title: 'White Threshold',
    medium: 'Chalk-ink on dyed cotton',
    dimensions: '16 × 16 in',
    year: '2026',
  },
] as const

const AUTOPLAY_MS = 7000
const USER_PAUSE_MS = 9000

export default function HeroExperience() {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const userPauseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const plateRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()

  // ── Autoplay rotation ───────────────────────────────────────────
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
    userPauseTimer.current = setTimeout(() => setPaused(false), USER_PAUSE_MS)
  }, [])

  const goTo = useCallback(
    (i: number) => {
      setActive(((i % SLIDES.length) + SLIDES.length) % SLIDES.length)
      userInteract()
    },
    [userInteract],
  )

  // ── Liquid Resin Shine - cursor-reactive specular ──────────────
  // The .resin-specular layer reads --rx / --ry custom properties on the
  // plate element. We update them on pointermove in CSS pixels so the
  // radial highlight tracks the cursor across the artwork. On idle the
  // gradient sits at the default (50% / 35%) for a centred catch of light.
  useEffect(() => {
    if (reduceMotion) return
    const plate = plateRef.current
    if (!plate) return

    const onPointerMove = (e: PointerEvent) => {
      const rect = plate.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100
      plate.style.setProperty('--rx', `${x.toFixed(1)}%`)
      plate.style.setProperty('--ry', `${y.toFixed(1)}%`)
    }
    const onPointerLeave = () => {
      plate.style.setProperty('--rx', '50%')
      plate.style.setProperty('--ry', '35%')
    }

    // Mobile: gyroscope tilt drives the same vars. Permission gates on iOS
    // 13+, so we attempt-and-fail-quietly rather than prompting unless the
    // user has interacted with the section (touch).
    let gyroBound = false
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return
      // gamma: left-right (-90..90), beta: front-back (-180..180)
      const x = 50 + Math.max(-30, Math.min(30, e.gamma)) * 1.2
      const y = 35 + Math.max(-30, Math.min(30, e.beta - 30)) * 0.7
      plate.style.setProperty('--rx', `${x.toFixed(1)}%`)
      plate.style.setProperty('--ry', `${y.toFixed(1)}%`)
    }
    const bindGyro = () => {
      if (gyroBound) return
      window.addEventListener('deviceorientation', onOrient, { passive: true })
      gyroBound = true
    }

    plate.addEventListener('pointermove', onPointerMove, { passive: true })
    plate.addEventListener('pointerleave', onPointerLeave, { passive: true })
    plate.addEventListener('touchstart', bindGyro, { passive: true, once: true })

    return () => {
      plate.removeEventListener('pointermove', onPointerMove)
      plate.removeEventListener('pointerleave', onPointerLeave)
      plate.removeEventListener('touchstart', bindGyro)
      if (gyroBound) window.removeEventListener('deviceorientation', onOrient)
    }
  }, [reduceMotion])

  // ── Touch swipe between slides ──────────────────────────────────
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
    goTo(active + (delta < 0 ? 1 : -1))
  }

  const slide = SLIDES[active]!
  const counter = String(active + 1).padStart(2, '0')
  const total = String(SLIDES.length).padStart(2, '0')

  return (
    <section
      aria-label="The Studio Vault - opening exhibition"
      className="relative w-full overflow-hidden bg-plum"
      style={{ height: '100svh', minHeight: 640, maxHeight: 1080 }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* ── 1. Backdrop: kolam cursor field ──────────────────────
          Sits at z-[1]; the dot pattern is low-contrast on the ivory
          ground, lifts to gold under the cursor. Self-pauses off-screen. */}
      <KolamCursorField
        density={32}
        interactionRadius={170}
        dotColor="rgba(250, 204, 21, 0.16)"
      />

      {/* ── 2. Soft warm wash behind the editorial column ────────
          Single warm ivory→sand gradient under the headline area so the
          fixed Header glyphs at the very top have darker ground without
          us painting an explicit scrim. Stops short of the artwork plate. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[2]"
        style={{
          background:
            'radial-gradient(ellipse 70% 90% at 0% 30%, rgba(242,235,221,0.85) 0%, transparent 60%)',
        }}
      />

      {/* ── 3. Editorial split grid ──────────────────────────────── */}
      <div className="relative z-[3] h-full w-full">
        <div className="h-full max-w-[1640px] mx-auto px-5 sm:px-10 lg:px-16 pt-24 lg:pt-32 pb-28 lg:pb-24">
          <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">

            {/* ── LEFT - editorial copy column ──────────────────── */}
            <div className="lg:col-span-6 flex flex-col justify-between order-2 lg:order-1">
              {/* Top eyebrow row */}
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-center gap-4"
              >
                <span
                  aria-hidden
                  className="h-px w-10 bg-ink/50"
                />
                <span
                  className="text-[11px] font-semibold uppercase text-ink/70"
                  style={{ letterSpacing: '0.32em' }}
                >
                  Exhibition I · 2026
                </span>
              </motion.div>

              {/* Display headline + lede + CTAs */}
              <div className="flex-1 flex flex-col justify-center max-w-xl">
                <motion.h1
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.95,
                    delay: 0.05,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="font-serif font-medium text-ink uppercase
                             leading-[1.02] tracking-[-0.01em]"
                  style={{
                    fontSize: 'clamp(48px, 7.4vw, 124px)',
                  }}
                >
                  Handmade
                  <br />
                  stories
                  <br />
                  crafted into{' '}
                  <span className="font-serif gold-text">art.</span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.9,
                    delay: 0.22,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="mt-8 text-ink/75 max-w-lg"
                  style={{
                    fontSize: 'clamp(15px, 1.05vw, 18px)',
                    lineHeight: 1.7,
                  }}
                >
                  A studio in Hyderabad, pouring resin, clay, and chalk-ink into
                  pieces meant to live with you for decades - not seasons. Step
                  inside.
                </motion.p>

                {/* CTA stack */}
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.9,
                    delay: 0.38,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="mt-10 flex flex-col items-start gap-5"
                >
                  <Link
                    href="/shop"
                    className="btn-resin"
                  >
                    Explore the Gallery
                    <ArrowRight className="w-4 h-4" aria-hidden />
                  </Link>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-7">
                    <Link
                      href="/custom-order"
                      className="group inline-flex items-center gap-3 text-sm font-semibold uppercase
                                 text-ink hover:text-ink transition-all duration-500"
                      style={{ letterSpacing: '0.14em' }}
                    >
                      <span className="relative">
                        Custom artwork
                        <span
                          aria-hidden
                          className="absolute -bottom-1 left-0 h-px w-full bg-ink/40
                                     scale-x-50 origin-left transition-transform duration-500
                                     group-hover:scale-x-100"
                        />
                      </span>
                      <span
                        aria-hidden
                        className="block h-px w-7 bg-ink/60 transition-all duration-500
                                   group-hover:w-10 group-hover:bg-ink"
                      />
                    </Link>

                    <a
                      href={waLink("Hi Srilatha, I'd like to commission a piece.")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex items-center gap-3 text-sm font-semibold uppercase
                                 text-[color:var(--accent-strong)] hover:text-[color:var(--gold-deep)]
                                 transition-colors duration-500"
                      style={{ letterSpacing: '0.14em' }}
                    >
                      <MessageCircle className="w-4 h-4" aria-hidden />
                      Commission via WhatsApp
                    </a>
                  </div>
                </motion.div>
              </div>

              {/* Museum caption - bottom of left column */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, delay: 0.6 }}
                className="hidden lg:flex items-center gap-6 pt-6"
                key={slide.title}
              >
                <span
                  className="text-[10px] font-semibold uppercase text-ink/55"
                  style={{ letterSpacing: '0.32em' }}
                >
                  Featured
                </span>
                <span className="h-px w-6 bg-ink/25" aria-hidden />
                <motion.div
                  key={`cap-${slide.title}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[11px] text-ink/70"
                  style={{ letterSpacing: '0.08em' }}
                >
                  <span className="font-serif text-base text-ink">
                    {slide.title}
                  </span>
                  <span aria-hidden className="text-ink/30">·</span>
                  <span className="uppercase">{slide.dimensions}</span>
                  <span aria-hidden className="text-ink/30">·</span>
                  <span className="uppercase">{slide.medium}</span>
                  <span aria-hidden className="text-ink/30">·</span>
                  <span className="uppercase">{slide.year}</span>
                </motion.div>
              </motion.div>
            </div>

            {/* ── RIGHT - artwork plate w/ Liquid Resin Shine ──── */}
            <div className="lg:col-span-6 relative order-1 lg:order-2 flex items-center justify-center">
              {/* Exhibition counter - corner of artwork column */}
              <div className="absolute top-0 right-0 z-[5] flex items-center gap-3">
                <motion.span
                  key={`ctr-${active}`}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  className="font-serif text-2xl text-ink"
                >
                  {counter}
                </motion.span>
                <span
                  aria-hidden
                  className="h-px w-6 bg-ink/40"
                />
                <span className="font-serif text-sm text-ink/55">{total}</span>
              </div>

              {/* The plate */}
              <div
                ref={plateRef}
                className="resin-plate relative w-full max-w-[640px] aspect-[4/5]"
                style={
                  {
                    // Default specular position - centred-upper, the natural
                    // catch of overhead gallery lighting.
                    ['--rx' as never]: '50%',
                    ['--ry' as never]: '35%',
                  } as React.CSSProperties
                }
              >
                {/* Slide stack - clip-path vertical wipe between active and
                    outgoing. Each layer is positioned absolute; the active
                    slide is fully revealed, others collapsed via clip-path. */}
                {SLIDES.map((s, i) => {
                  const isActive = i === active
                  return (
                    <div
                      key={s.src}
                      className="absolute inset-0"
                      style={{
                        clipPath: isActive
                          ? 'inset(0 0 0 0)'
                          : 'inset(0 100% 0 0)',
                        transition: reduceMotion
                          ? 'none'
                          : `clip-path 700ms var(--ease-gallery)`,
                        zIndex: isActive ? 2 : 1,
                      }}
                      aria-hidden={!isActive}
                    >
                      <PictureImage
                        src={s.src}
                        alt={s.alt}
                        fill
                        sizes="(min-width: 1024px) 50vw, 100vw"
                        priority={i === 0}
                        loading={i === 0 ? 'eager' : 'lazy'}
                        className="object-cover"
                      />
                    </div>
                  )
                })}

                {/* Cursor-reactive specular - sits above the artwork, below
                    the resin sheen pseudo-elements. */}
                <div className="resin-specular" />
              </div>

              {/* Slide pagination - vertical tick column to the right of the plate */}
              <div className="absolute right-0 top-1/2 -translate-y-1/2 hidden lg:flex flex-col items-end gap-4 pr-1">
                {SLIDES.map((s, i) => {
                  const isActive = i === active
                  return (
                    <button
                      key={s.src}
                      type="button"
                      onClick={() => goTo(i)}
                      aria-label={`Show ${s.title}`}
                      aria-current={isActive ? 'true' : undefined}
                      className="group flex items-center gap-3 py-1.5"
                    >
                      <span
                        className={`text-[10px] font-semibold uppercase transition-colors duration-500 ${
                          isActive ? 'text-ink' : 'text-ink/35 group-hover:text-ink/65'
                        }`}
                        style={{ letterSpacing: '0.24em' }}
                      >
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span
                        aria-hidden
                        className={`block h-px transition-all duration-500 ${
                          isActive
                            ? 'w-12 bg-ink'
                            : 'w-5 bg-ink/35 group-hover:w-8 group-hover:bg-ink/60'
                        }`}
                      />
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. Mobile museum caption - full-width bottom strip ─── */}
      <motion.div
        key={`mcap-${slide.title}`}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="lg:hidden absolute inset-x-0 bottom-16 z-[4] px-5"
      >
        <div className="flex items-baseline gap-2 text-[10px] text-ink/70 flex-wrap">
          <span className="font-serif text-sm text-ink">{slide.title}</span>
          <span aria-hidden className="text-ink/30">·</span>
          <span className="uppercase" style={{ letterSpacing: '0.08em' }}>
            {slide.dimensions}
          </span>
          <span aria-hidden className="text-ink/30">·</span>
          <span className="uppercase" style={{ letterSpacing: '0.08em' }}>
            {slide.medium}
          </span>
        </div>
      </motion.div>

      {/* ── 5. Scroll cue - bottom-center hand-drawn mark ─────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, delay: 0.9 }}
        className="absolute inset-x-0 bottom-5 lg:bottom-7 z-[4] flex flex-col items-center gap-2 pointer-events-none"
      >
        <span
          className="text-[10px] font-semibold uppercase text-ink/55"
          style={{ letterSpacing: '0.32em' }}
        >
          Enter the studio
        </span>
        <motion.span
          aria-hidden
          className="block w-px bg-ink/40"
          initial={{ height: 0 }}
          animate={{ height: reduceMotion ? 28 : [10, 28, 10] }}
          transition={
            reduceMotion
              ? { duration: 0.4 }
              : {
                  duration: 2.4,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }
          }
        />
      </motion.div>
    </section>
  )
}
