'use client'

/**
 * CollectionExhibition - Room 03 of the Studio Vault.
 *
 * Not a category grid. A horizontal exhibition wing: five full-viewport
 * collection rooms (Resin, Lippan, Kolam, Wedding Decor, Custom)
 * connected by native scroll-snap. Each room is its own atmospheric
 * environment - its own tonal wash, its own editorial copy, its own
 * featured piece mounted in a `.resin-plate` carrying the Liquid Resin
 * Shine. The visitor walks horizontally through the wing the way they'd
 * walk through a curated museum corridor.
 *
 * Structural rules (so the experience reads "museum" not "carousel"):
 *   - One outer 100svh section pins the chrome (room title, progress
 *     counter, prev/next, swipe affordance). The chrome is stationary;
 *     only the artwork rooms move.
 *   - Horizontal scroll uses CSS scroll-snap (mandatory, x). Native is
 *     better than JS-driven sliders: tab order works, screen readers
 *     navigate, momentum scroll on trackpad/touch is OS-native.
 *   - Each `.collection-room` element is 100vw × 100svh, snap-start.
 *   - A wheel listener redirects vertical wheel input to horizontal
 *     scroll WHILE the section is the dominant viewport occupant - so
 *     desktop users with a normal mouse wheel still progress through
 *     the wing naturally. Released once they reach the final room so
 *     vertical scrolling can continue down the page.
 *   - Per-room atmosphere: each collection has its own warm gradient
 *     backdrop derived from the work's tonal signature.
 *
 * Signature interaction inside this room:
 *   The featured plate in each collection carries Liquid Resin Shine
 *   (gold sweep + cursor-reactive specular + top sheen + edge depth).
 *   It is the same primitive used in the Hero - consistency across the
 *   site, deployed sparingly where the artwork is the hero.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import PictureImage from '@/components/PictureImage'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, ArrowLeft } from 'lucide-react'

interface CollectionData {
  slug: string
  name: string
  eyebrow: string
  intro: string
  feature: {
    src: string
    alt: string
    title: string
    medium: string
    dimensions: string
    year: string
  }
  cta: { label: string; href: string }
  /** Backdrop wash - defines the room's atmospheric "lighting." Each is a
   *  CSS background value; ivory base, warm overlay tuned to the work. */
  atmosphere: string
}

const COLLECTIONS: readonly CollectionData[] = [
  {
    slug: 'resin',
    name: 'Resin',
    eyebrow: 'Wing I - Liquid',
    intro:
      'Pigment suspended in clear resin, poured by hand, cured for days. Each piece is a snapshot of motion held still.',
    feature: {
      src: '/Slideshow/01-resin.jpg',
      alt: 'Vermilion Tide - featured resin work',
      title: 'Vermilion Tide',
      medium: 'Resin & gold leaf on birch panel',
      dimensions: '22 × 30 in',
      year: '2026',
    },
    cta: { label: 'Enter the Resin wing', href: '/shop?category=resin' },
    atmosphere:
      'linear-gradient(135deg, rgba(245,224,168,0.30) 0%, rgba(251,248,242,1) 55%, rgba(232,180,120,0.25) 100%)',
  },
  {
    slug: 'lippan',
    name: 'Lippan',
    eyebrow: 'Wing II - Earth & Mirror',
    intro:
      'A 400-year-old Kutch tradition reinterpreted for the modern wall. Clay relief, hand-cut mirror, and patient hands.',
    feature: {
      src: '/Slideshow/03-lippan.jpg',
      alt: 'Mirror Garden - featured lippan work',
      title: 'Mirror Garden',
      medium: 'Lippan clay & hand-cut mirror',
      dimensions: '18 × 24 in',
      year: '2025',
    },
    cta: { label: 'Enter the Lippan wing', href: '/shop?category=lippan' },
    atmosphere:
      'linear-gradient(135deg, rgba(195,80,26,0.18) 0%, rgba(251,248,242,1) 60%, rgba(138,106,26,0.20) 100%)',
  },
  {
    slug: 'kolam',
    name: 'Kolam',
    eyebrow: 'Wing III - Threshold',
    intro:
      'The single-stroke kolam - once drawn at dawn outside every South Indian doorway - translated to canvas, paper, and silk.',
    feature: {
      src: '/Slideshow/04-kolam.jpg',
      alt: 'White Threshold - featured kolam work',
      title: 'White Threshold',
      medium: 'Chalk-ink on dyed cotton',
      dimensions: '16 × 16 in',
      year: '2026',
    },
    cta: { label: 'Enter the Kolam wing', href: '/shop?category=kolam' },
    atmosphere:
      'linear-gradient(135deg, rgba(34,27,18,0.14) 0%, rgba(251,248,242,1) 55%, rgba(200,150,47,0.18) 100%)',
  },
  {
    slug: 'wedding',
    name: 'Wedding',
    eyebrow: 'Wing IV - Festival',
    intro:
      'Keepsakes made for thresholds: garlands, varmalai, sacred mandap details. Built to be photographed, then framed for life.',
    feature: {
      src: '/Slideshow/05-wedding-decoratives.jpg',
      alt: 'Threshold Garlands - featured wedding work',
      title: 'Threshold Garlands',
      medium: 'Resin, brass, silk thread',
      dimensions: 'Bespoke',
      year: '2026',
    },
    cta: { label: 'Enter the Wedding wing', href: '/shop?category=wedding' },
    atmosphere:
      'linear-gradient(135deg, rgba(232,194,90,0.30) 0%, rgba(251,248,242,1) 55%, rgba(195,80,26,0.22) 100%)',
  },
  {
    slug: 'custom',
    name: 'Commission',
    eyebrow: 'Wing V - On Request',
    intro:
      'A piece made for the wall it will live on. We begin with a conversation, end with a one-of-one signed work.',
    feature: {
      src: '/Slideshow/02-dot-mandala.jpg',
      alt: 'Patron Commission - featured custom work',
      title: 'Patron Commission Series',
      medium: 'Mixed-media, dimensions on request',
      dimensions: 'To order',
      year: '2026',
    },
    cta: { label: 'Begin a commission', href: '/custom-order' },
    atmosphere:
      'linear-gradient(135deg, rgba(67,57,46,0.18) 0%, rgba(251,248,242,1) 50%, rgba(200,150,47,0.20) 100%)',
  },
] as const

export default function CollectionExhibition() {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const sectionRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const reduceMotion = useReducedMotion()

  // ── Track which collection is in view, drive the chrome counter ──
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return

    const rooms = Array.from(
      scroller.querySelectorAll<HTMLElement>('[data-room-index]'),
    )

    const io = new IntersectionObserver(
      (entries) => {
        // Pick the room with the largest visible area as "active." Multiple
        // rooms can be partially in view during snap; the dominant one wins.
        let bestIdx = active
        let bestRatio = 0
        for (const e of entries) {
          if (e.intersectionRatio > bestRatio) {
            bestRatio = e.intersectionRatio
            const idx = Number((e.target as HTMLElement).dataset.roomIndex)
            if (!Number.isNaN(idx)) bestIdx = idx
          }
        }
        if (bestRatio > 0.5) setActive(bestIdx)
      },
      {
        root: scroller,
        threshold: [0.25, 0.5, 0.75, 1],
      },
    )

    rooms.forEach((r) => io.observe(r))
    return () => io.disconnect()
    // We deliberately don't include `active` - that would re-run the effect
    // every snap; the closure capture is fine because we always read fresh
    // from the entries inside the callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Translate vertical wheel into horizontal scroll, but ONLY while
  //    the wing is the dominant viewport occupant AND we have room to
  //    travel horizontally. Once the user reaches the last collection,
  //    further vertical wheel falls through to the page so they exit
  //    the wing naturally. Disabled on touch (handled by native snap). ──
  useEffect(() => {
    if (reduceMotion) return
    const scroller = scrollerRef.current
    const section = sectionRef.current
    if (!scroller || !section) return

    const onWheel = (e: WheelEvent) => {
      // Trackpad horizontal gestures pass deltaX naturally; ignore.
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return

      const rect = section.getBoundingClientRect()
      // Only intercept if the section dominates the viewport (top is near
      // or above viewport top, bottom is near or below viewport bottom).
      const isDominant =
        rect.top <= 8 && rect.bottom >= window.innerHeight - 8
      if (!isDominant) return

      const maxScroll = scroller.scrollWidth - scroller.clientWidth
      const atStart = scroller.scrollLeft <= 4
      const atEnd = scroller.scrollLeft >= maxScroll - 4

      // Let the page take over once we've reached either horizontal end
      // in the direction the user is going. Otherwise consume the event
      // and translate Y→X.
      if (e.deltaY > 0 && atEnd) return
      if (e.deltaY < 0 && atStart) return

      e.preventDefault()
      scroller.scrollLeft += e.deltaY
    }

    section.addEventListener('wheel', onWheel, { passive: false })
    return () => section.removeEventListener('wheel', onWheel)
  }, [reduceMotion])

  // ── Liquid Resin Shine - cursor-reactive specular per plate. We bind
  //    a single delegated pointermove on the scroller and dispatch to
  //    whichever plate is under the cursor. Cheaper than N listeners. ──
  useEffect(() => {
    if (reduceMotion) return
    const scroller = scrollerRef.current
    if (!scroller) return

    const onMove = (e: PointerEvent) => {
      const target = (e.target as Element | null)?.closest(
        '[data-resin-plate]',
      ) as HTMLElement | null
      if (!target) return
      const r = target.getBoundingClientRect()
      target.style.setProperty(
        '--rx',
        `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`,
      )
      target.style.setProperty(
        '--ry',
        `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`,
      )
    }
    scroller.addEventListener('pointermove', onMove, { passive: true })
    return () => scroller.removeEventListener('pointermove', onMove)
  }, [reduceMotion])

  const goTo = useCallback((i: number) => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const target = scroller.querySelector<HTMLElement>(
      `[data-room-index="${i}"]`,
    )
    if (!target) return
    scroller.scrollTo({ left: target.offsetLeft, behavior: 'smooth' })
  }, [])

  // Keyboard nav - arrow keys move between rooms when the section has focus.
  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const onKey = (e: KeyboardEvent) => {
      if (!section.contains(document.activeElement)) return
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        goTo(Math.min(active + 1, COLLECTIONS.length - 1))
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goTo(Math.max(active - 1, 0))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, goTo])

  return (
    <section
      ref={sectionRef}
      aria-label="The Collections - Studio Vault Wing"
      tabIndex={0}
      className="relative w-full bg-plum overflow-hidden focus:outline-none"
      style={{ height: '100svh', minHeight: 640 }}
    >
      {/* ── Pinned chrome ─────────────────────────────────────────── */}
      {/* Top-left: room title */}
      <div className="absolute top-8 lg:top-10 left-5 sm:left-10 lg:left-16 z-[5] pointer-events-none">
        <div className="flex items-center gap-4">
          <span aria-hidden className="h-px w-10 bg-ink/50" />
          <span
            className="text-[11px] font-semibold uppercase text-ink/70"
            style={{ letterSpacing: '0.32em' }}
          >
            Room 03 - The Collections
          </span>
        </div>
      </div>

      {/* Top-right: room counter */}
      <div className="absolute top-8 lg:top-10 right-5 sm:right-10 lg:right-16 z-[5] flex items-center gap-3 pointer-events-none">
        <motion.span
          key={`ce-ctr-${active}`}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="font-serif text-2xl text-ink"
        >
          {String(active + 1).padStart(2, '0')}
        </motion.span>
        <span aria-hidden className="h-px w-6 bg-ink/40" />
        <span className="font-serif text-sm text-ink/55">
          {String(COLLECTIONS.length).padStart(2, '0')}
        </span>
      </div>

      {/* ── The horizontal scroller ──────────────────────────────── */}
      <div
        ref={scrollerRef}
        className="absolute inset-0 flex overflow-x-auto overflow-y-hidden scrollbar-hide
                   snap-x snap-mandatory scroll-smooth"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {COLLECTIONS.map((col, i) => (
          <article
            key={col.slug}
            data-room-index={i}
            className="relative shrink-0 snap-start w-screen h-[100svh]"
            style={{ background: col.atmosphere }}
            aria-labelledby={`col-${col.slug}-title`}
          >
            {/* Room contents - editorial split, identical bone structure to
                Room 01 so the language is consistent across the site. */}
            <div className="h-full w-full max-w-[1640px] mx-auto px-5 sm:px-10 lg:px-16 pt-28 lg:pt-32 pb-28 lg:pb-28">
              <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">

                {/* Editorial copy column */}
                <div className="lg:col-span-5 flex flex-col justify-between order-2 lg:order-1">
                  <motion.div
                    initial={reduceMotion ? false : { opacity: 0, y: -8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ root: scrollerRef, amount: 0.6, once: false }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    className="flex items-center gap-3"
                  >
                    <span
                      className="text-[10px] font-semibold uppercase text-ink/65"
                      style={{ letterSpacing: '0.36em' }}
                    >
                      {col.eyebrow}
                    </span>
                  </motion.div>

                  <div className="flex-1 flex flex-col justify-center max-w-xl">
                    <motion.h2
                      id={`col-${col.slug}-title`}
                      initial={reduceMotion ? false : { opacity: 0, y: 24 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ root: scrollerRef, amount: 0.5, once: false }}
                      transition={{
                        duration: 0.95,
                        delay: 0.05,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="font-serif font-medium text-ink uppercase leading-[1.02] tracking-[-0.01em]"
                      style={{ fontSize: 'clamp(48px, 7vw, 116px)' }}
                    >
                      {col.name}
                      <span aria-hidden className="block h-1 mt-5 w-16 bg-[color:var(--accent-strong)]" />
                    </motion.h2>

                    <motion.p
                      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ root: scrollerRef, amount: 0.55, once: false }}
                      transition={{
                        duration: 0.9,
                        delay: 0.18,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="mt-8 text-ink/75 max-w-lg"
                      style={{
                        fontSize: 'clamp(15px, 1.05vw, 18px)',
                        lineHeight: 1.7,
                      }}
                    >
                      {col.intro}
                    </motion.p>

                    <motion.div
                      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ root: scrollerRef, amount: 0.55, once: false }}
                      transition={{
                        duration: 0.9,
                        delay: 0.32,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="mt-10"
                    >
                      <Link href={col.cta.href} className="btn-resin">
                        {col.cta.label}
                        <ArrowRight className="w-4 h-4" aria-hidden />
                      </Link>
                    </motion.div>
                  </div>

                  {/* Museum caption */}
                  <motion.div
                    initial={reduceMotion ? false : { opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ root: scrollerRef, amount: 0.6, once: false }}
                    transition={{ duration: 0.8, delay: 0.5 }}
                    className="hidden lg:flex items-center gap-6 pt-6"
                  >
                    <span
                      className="text-[10px] font-semibold uppercase text-ink/55"
                      style={{ letterSpacing: '0.32em' }}
                    >
                      Featured
                    </span>
                    <span className="h-px w-6 bg-ink/25" aria-hidden />
                    <div
                      className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[11px] text-ink/70"
                      style={{ letterSpacing: '0.08em' }}
                    >
                      <span className="font-serif text-base text-ink">
                        {col.feature.title}
                      </span>
                      <span aria-hidden className="text-ink/30">·</span>
                      <span className="uppercase">{col.feature.dimensions}</span>
                      <span aria-hidden className="text-ink/30">·</span>
                      <span className="uppercase">{col.feature.medium}</span>
                      <span aria-hidden className="text-ink/30">·</span>
                      <span className="uppercase">{col.feature.year}</span>
                    </div>
                  </motion.div>
                </div>

                {/* Featured plate - Liquid Resin Shine */}
                <div className="lg:col-span-7 relative order-1 lg:order-2 flex items-center justify-center">
                  <motion.div
                    initial={
                      reduceMotion ? false : { opacity: 0, y: 30, scale: 0.98 }
                    }
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    viewport={{ root: scrollerRef, amount: 0.5, once: false }}
                    transition={{
                      duration: 1.1,
                      delay: 0.12,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    data-resin-plate
                    className="resin-plate relative w-full max-w-[760px] aspect-[4/5]"
                    style={
                      {
                        ['--rx' as never]: '50%',
                        ['--ry' as never]: '35%',
                      } as React.CSSProperties
                    }
                  >
                    <PictureImage
                      src={col.feature.src}
                      alt={col.feature.alt}
                      fill
                      sizes="(min-width: 1024px) 55vw, 100vw"
                      loading={i === 0 ? 'eager' : 'lazy'}
                      priority={i === 0}
                      className="object-cover"
                    />
                    <div className="resin-specular" />
                  </motion.div>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* ── Mobile museum caption - bottom-anchored, updates per room ── */}
      <div className="lg:hidden absolute inset-x-0 bottom-20 z-[5] px-5 pointer-events-none">
        <motion.div
          key={`mcap-${active}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-baseline gap-2 text-[10px] text-ink/70 flex-wrap"
        >
          <span className="font-serif text-sm text-ink">
            {COLLECTIONS[active]!.feature.title}
          </span>
          <span aria-hidden className="text-ink/30">·</span>
          <span className="uppercase" style={{ letterSpacing: '0.08em' }}>
            {COLLECTIONS[active]!.feature.dimensions}
          </span>
          <span aria-hidden className="text-ink/30">·</span>
          <span className="uppercase" style={{ letterSpacing: '0.08em' }}>
            {COLLECTIONS[active]!.feature.medium}
          </span>
        </motion.div>
      </div>

      {/* ── Bottom progress bar - tick per room ───────────────────── */}
      <div className="absolute inset-x-0 bottom-6 lg:bottom-8 z-[5] flex items-center justify-center gap-3 pointer-events-none">
        {COLLECTIONS.map((col, i) => {
          const isActive = i === active
          return (
            <button
              key={col.slug}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Show ${col.name} collection`}
              aria-current={isActive ? 'true' : undefined}
              className="group p-2 -m-2 pointer-events-auto"
            >
              <span
                aria-hidden
                className={`block h-[2px] transition-all duration-500 ${
                  isActive
                    ? 'w-14 bg-ink'
                    : 'w-7 bg-ink/30 group-hover:bg-ink/55 group-hover:w-9'
                }`}
              />
            </button>
          )
        })}
      </div>

      {/* ── Side arrows - desktop only ────────────────────────────── */}
      <button
        type="button"
        onClick={() => goTo(Math.max(active - 1, 0))}
        disabled={active === 0}
        aria-label="Previous collection"
        className="hidden lg:flex absolute left-4 top-1/2 -translate-y-1/2 z-[5]
                   w-11 h-11 items-center justify-center rounded-full
                   bg-white text-ink border border-ink/12
                   shadow-card hover:shadow-editorial
                   transition-all duration-500
                   disabled:opacity-30 disabled:pointer-events-none"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() =>
          goTo(Math.min(active + 1, COLLECTIONS.length - 1))
        }
        disabled={active === COLLECTIONS.length - 1}
        aria-label="Next collection"
        className="hidden lg:flex absolute right-4 top-1/2 -translate-y-1/2 z-[5]
                   w-11 h-11 items-center justify-center rounded-full
                   bg-white text-ink border border-ink/12
                   shadow-card hover:shadow-editorial
                   transition-all duration-500
                   disabled:opacity-30 disabled:pointer-events-none"
      >
        <ArrowRight className="w-4 h-4" aria-hidden />
      </button>

      {/* SR-only live region announces room changes */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        Now viewing {COLLECTIONS[active]!.name}, collection {active + 1} of{' '}
        {COLLECTIONS.length}
      </p>
    </section>
  )
}
