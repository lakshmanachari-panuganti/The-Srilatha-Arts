'use client'

/**
 * ProcessFilm - Room 04 of the Studio Vault.
 *
 * Five-chapter scroll-bound film documenting the making of Vermilion Tide.
 * The chapters cross-fade as the visitor scrolls through a sticky stage;
 * a Labour Ledger in the corner accumulates the hours - 0 → 32 - as the
 * arc progresses, making the abstract "32 hours" of FeaturedWorks Plate I
 * a remembered experience.
 *
 * After Chapter V the sticky releases and the End Panel scrolls in: the
 * piece thumbnail with Liquid Resin Shine, full caption + pricing, and an
 * ActionPanel routing the visitor to Buy Now / Add to Cart / View Details
 * / Inquire - the same primitive Featured Works uses, via the shared module.
 *
 * Chapter media is graceful. Every chapter declares its own media state
 * independently:
 *
 *   blueprint  →  typographic placeholder - looks like an intentional
 *                  printed plate divider, not a missing image. Ships today.
 *   still      →  a photograph. Drops in via /public/process-film/<slug>/.
 *   video      →  6–10s muted loop. Desktop autoplay; mobile shows poster.
 *
 * Upgrading a chapter is a one-line edit to processFilmData.ts. No code
 * changes required.
 */

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import PictureImage from '@/components/PictureImage'
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
  type MotionValue,
} from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import {
  CHAPTERS,
  PIECE,
  FILM_SLUG,
  TOTAL_HOURS,
  PROGRESS_BREAKPOINTS,
  CUMULATIVE_HOURS_TIMELINE,
  type Chapter,
  type ChapterMedia,
} from './shared/processFilmData'
import { ActionPanel, AvailabilityBadge } from './shared/actions'
import { trackEvent, formatINR } from './shared/analytics'

const STAGE_END = 0.80 // last 20% of section = End Panel reveal
const ROMAN = ['I', 'II', 'III', 'IV', 'V'] as const

/**
 * Per-chapter opacity envelope.
 *
 * Each chapter owns 16% of the sticky-stage scroll budget (5 chapters
 * × 16% = 80%). Within its slot, the chapter ramps in over the first
 * 25% and ramps out over the last 25%, leaving a 50% hold at full
 * opacity. The first chapter starts visible (no fade-in); the last
 * never fades out (the visitor lands on Chapter V's Delivery still
 * before the End Panel scrolls in).
 */
function useChapterOpacity(
  progress: MotionValue<number>,
  index: number,
): MotionValue<number> {
  const slotSize = STAGE_END / CHAPTERS.length // 0.16
  const slotStart = index * slotSize
  const slotEnd = (index + 1) * slotSize
  const fadeWidth = 0.04

  const fadeIn = index === 0 ? slotStart : slotStart - fadeWidth
  const holdIn = slotStart + fadeWidth
  const holdOut =
    index === CHAPTERS.length - 1 ? slotEnd : slotEnd - fadeWidth
  const fadeOut = slotEnd

  return useTransform(
    progress,
    [fadeIn, holdIn, holdOut, fadeOut],
    [
      index === 0 ? 1 : 0,
      1,
      1,
      index === CHAPTERS.length - 1 ? 1 : 0,
    ],
  )
}

export default function ProcessFilm() {
  const ref = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  })

  // One useTransform call per chapter - fixed order, hook count stable.
  const op0 = useChapterOpacity(scrollYProgress, 0)
  const op1 = useChapterOpacity(scrollYProgress, 1)
  const op2 = useChapterOpacity(scrollYProgress, 2)
  const op3 = useChapterOpacity(scrollYProgress, 3)
  const op4 = useChapterOpacity(scrollYProgress, 4)
  const opacities = [op0, op1, op2, op3, op4]

  // Smooth cumulative hours - interpolates between chapter peaks.
  const totalHours = useTransform(
    scrollYProgress,
    PROGRESS_BREAKPOINTS as number[],
    CUMULATIVE_HOURS_TIMELINE as number[],
  )

  // Discrete active chapter index - drives the chrome counter and the
  // ledger's "+04h · Sketch" sub-label.
  const activeIndex = useTransform(scrollYProgress, (p): number => {
    if (p < 0.16) return 0
    if (p < 0.32) return 1
    if (p < 0.48) return 2
    if (p < 0.64) return 3
    return 4
  })

  // `film_complete` analytics event - fires once when Chapter V peaks.
  const filmCompleteFired = useRef(false)
  useEffect(() => {
    return scrollYProgress.on('change', (p) => {
      if (p > 0.78 && !filmCompleteFired.current) {
        filmCompleteFired.current = true
        trackEvent({
          name: 'film_complete',
          params: { film_slug: FILM_SLUG, total_hours: TOTAL_HOURS },
        })
      }
    })
  }, [scrollYProgress])

  return (
    <section
      ref={ref}
      aria-label="The Making - Room 04"
      className="relative w-full bg-plum"
      style={{ minHeight: '350svh' }}
    >
      {/* Skip-to-commerce link - keyboard / SR users who already know the
          piece they want can route straight to the End Panel. Fires its
          own analytics event so we can measure how many use it. */}
      <a
        href="#process-film-end-panel"
        onClick={() =>
          trackEvent({
            name: 'film_skip_to_commerce',
            params: { film_slug: FILM_SLUG },
          })
        }
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-1/2
                   focus:-translate-x-1/2 focus:z-[10] focus:px-3 focus:py-1.5
                   focus:bg-ink focus:text-plum focus:text-xs focus:rounded-sm"
      >
        Skip film - go to the piece
      </a>

      {/* ── Sticky stage - chapters cross-fade here ────────────── */}
      <div className="sticky top-0 h-[100svh] w-full overflow-hidden">
        {/* Warm directional wash - keeps the stage from reading flat ivory */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            background:
              'radial-gradient(ellipse 80% 70% at 20% 30%, rgba(242,235,221,0.55) 0%, transparent 60%),' +
              'radial-gradient(ellipse 70% 60% at 90% 80%, rgba(200,150,47,0.08) 0%, transparent 60%)',
          }}
        />

        {/* Top-left room title */}
        <div className="absolute top-8 lg:top-10 left-5 sm:left-10 lg:left-16 z-[6] pointer-events-none">
          <div className="flex items-center gap-4">
            <span aria-hidden className="h-px w-10 bg-ink/50" />
            <span
              className="text-[11px] font-semibold uppercase text-ink/70"
              style={{ letterSpacing: '0.32em' }}
            >
              Room 04 - The Making
            </span>
          </div>
        </div>

        {/* Top-right chapter counter */}
        <div className="absolute top-8 lg:top-10 right-5 sm:right-10 lg:right-16 z-[6] flex items-center gap-3 pointer-events-none">
          <ChapterCounter index={activeIndex} reduceMotion={!!reduceMotion} />
          <span aria-hidden className="h-px w-6 bg-ink/40" />
          <span className="font-serif text-sm text-ink/55">V</span>
        </div>

        {/* Chapter frames - layered absolute, opacity per scroll envelope */}
        <div className="absolute inset-0 z-[2]">
          {CHAPTERS.map((chapter, i) => (
            <ChapterFrame
              key={chapter.no}
              chapter={chapter}
              opacity={
                reduceMotion ? (i === 0 ? 1 : 0) : opacities[i]!
              }
              isFirst={i === 0}
            />
          ))}
        </div>

        {/* Labour Ledger - pinned bottom-right of the stage */}
        <LabourLedger
          totalHours={totalHours}
          activeIndex={activeIndex}
          reduceMotion={!!reduceMotion}
        />
      </div>

      {/* ── End Panel - scrolls in after sticky releases ──────── */}
      <div
        id="process-film-end-panel"
        className="relative w-full pt-24 lg:pt-32 pb-20 lg:pb-28"
      >
        <EndPanel />
      </div>
    </section>
  )
}

// ────────────────────────────────────────────────────────────────────
// ChapterFrame - editorial copy + media side-by-side.
// All five frames render simultaneously, layered absolute. Their
// `opacity` motion value handles cross-fade as the visitor scrolls.
// ────────────────────────────────────────────────────────────────────
function ChapterFrame({
  chapter,
  opacity,
  isFirst,
}: {
  chapter: Chapter
  opacity: MotionValue<number> | number
  isFirst: boolean
}) {
  return (
    <motion.div
      style={{ opacity }}
      className="absolute inset-0 will-change-transform"
      aria-hidden={!isFirst || undefined}
    >
      <div className="h-full w-full max-w-[1640px] mx-auto px-5 sm:px-10 lg:px-16 pt-24 pb-28 lg:pt-32 lg:pb-36">
        <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-16">
          {/* Editorial column */}
          <div className="lg:col-span-5 flex flex-col justify-center order-2 lg:order-1 max-w-xl">
            <div className="flex items-center gap-3 mb-5">
              <span
                className="text-[10px] font-semibold uppercase text-ink/65"
                style={{ letterSpacing: '0.36em' }}
              >
                {chapter.eyebrow}
              </span>
              <span aria-hidden className="h-px w-6 bg-ink/30" />
            </div>
            <h2
              className="font-serif font-medium text-ink uppercase leading-[1.02] tracking-[-0.01em] text-balance"
              style={{ fontSize: 'clamp(40px, 6vw, 96px)' }}
            >
              {chapter.title}
            </h2>
            <p
              className="mt-6 text-ink/75 max-w-lg"
              style={{
                fontSize: 'clamp(15px, 1.05vw, 18px)',
                lineHeight: 1.7,
              }}
            >
              {chapter.body}
            </p>
            {chapter.pullQuote && (
              <p
                className="mt-6 font-serif text-ink/80 max-w-md border-l-2 pl-5"
                style={{
                  borderColor: 'var(--accent-strong)',
                  fontSize: 'clamp(17px, 1.4vw, 22px)',
                  lineHeight: 1.5,
                }}
              >
                “{chapter.pullQuote}”
              </p>
            )}
          </div>

          {/* Media frame */}
          <div className="lg:col-span-7 relative order-1 lg:order-2 min-h-[44svh] lg:min-h-0 flex items-stretch">
            <div
              className="relative w-full h-full rounded-sm overflow-hidden"
              style={{ border: '1px solid rgba(34,27,18,0.08)' }}
            >
              <MediaView media={chapter.media} chapter={chapter} />
              {/* Shot caption strip pinned to bottom edge of media */}
              <div
                aria-hidden
                className="absolute inset-x-0 bottom-0 z-[3] px-5 py-3"
                style={{
                  background:
                    'linear-gradient(to top, rgba(20,16,10,0.55) 0%, rgba(20,16,10,0.15) 70%, transparent 100%)',
                }}
              />
              <p
                className="absolute inset-x-0 bottom-3 z-[4] px-5 text-[10px] font-semibold uppercase text-white/90"
                style={{ letterSpacing: '0.28em' }}
              >
                {chapter.shotCaption}
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ────────────────────────────────────────────────────────────────────
// MediaView - renders the three chapter media states.
// ────────────────────────────────────────────────────────────────────
function MediaView({
  media,
  chapter,
}: {
  media: ChapterMedia
  chapter: Chapter
}) {
  if (media.type === 'blueprint') {
    return <BlueprintCard chapter={chapter} />
  }
  if (media.type === 'still') {
    return (
      <>
        <PictureImage
          src={media.src}
          alt={media.alt}
          fill
          sizes="(min-width: 1024px) 55vw, 100vw"
          priority={chapter.no === 'I'}
          loading={chapter.no === 'I' ? 'eager' : 'lazy'}
          className="object-cover"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-paper-grain opacity-[0.04] mix-blend-overlay pointer-events-none"
        />
      </>
    )
  }
  // video
  return (
    <>
      {/* Mobile fallback - poster only. Plain <img> here so the URL the
          studio uploads is honoured without going through next/image's
          optimisation pipeline (which is unoptimized in static export). */}
      <picture className="lg:hidden absolute inset-0">
        <img
          src={media.poster}
          alt={media.alt}
          className="w-full h-full object-cover"
        />
      </picture>
      {/* Desktop video - autoplay, muted, loops, plays inline.
          preload=metadata so the file metadata loads but no payload until
          the chapter becomes active. */}
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster={media.poster}
        aria-label={media.alt}
        className="hidden lg:block absolute inset-0 w-full h-full object-cover"
      >
        <source src={media.src} type="video/mp4" />
      </video>
      <div
        aria-hidden
        className="absolute inset-0 bg-paper-grain opacity-[0.04] mix-blend-overlay pointer-events-none"
      />
    </>
  )
}

// ────────────────────────────────────────────────────────────────────
// BlueprintCard - the typographic placeholder that ships today.
//
// Reads as an intentional printed plate divider, not a missing image.
// The chapter title is the visual; the paper-grain ground + gold rule
// + subtle background numeral give it the museum-card register.
// ────────────────────────────────────────────────────────────────────
function BlueprintCard({ chapter }: { chapter: Chapter }) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center px-8 py-12"
      style={{ background: 'rgb(var(--surface-sunken-rgb))' }}
    >
      {/* Paper grain */}
      <div
        aria-hidden
        className="absolute inset-0 bg-paper-grain opacity-[0.14] mix-blend-overlay pointer-events-none"
      />
      {/* Soft gold wash */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 70% at 50% 50%, rgba(232,194,90,0.12) 0%, transparent 70%)',
        }}
      />
      {/* Background numeral watermark */}
      <span
        aria-hidden
        className="absolute font-serif text-ink/[0.04] select-none pointer-events-none leading-none"
        style={{
          fontSize: 'clamp(240px, 38vw, 520px)',
          letterSpacing: '-0.04em',
        }}
      >
        {chapter.no}
      </span>

      {/* Foreground content */}
      <div className="relative z-[2] text-center max-w-md">
        <p
          className="text-[10px] font-semibold uppercase text-ink/55 mb-4"
          style={{ letterSpacing: '0.36em' }}
        >
          Plate - Chapter {chapter.no}
        </p>
        <h3
          className="font-serif text-ink leading-[1.04] text-balance"
          style={{ fontSize: 'clamp(44px, 5vw, 84px)' }}
        >
          {chapter.title}
        </h3>
        <span
          aria-hidden
          className="block h-px w-12 mx-auto mt-6"
          style={{ background: 'var(--accent-strong)' }}
        />
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// LabourLedger - the signature interaction.
// A small chronometer-style card pinned bottom-right of the sticky
// stage. The hour count ticks up scroll-bound. The active-chapter
// sub-label changes per chapter ("+04h · Sketch").
// ────────────────────────────────────────────────────────────────────
function LabourLedger({
  totalHours,
  activeIndex,
  reduceMotion,
}: {
  totalHours: MotionValue<number>
  activeIndex: MotionValue<number>
  reduceMotion: boolean
}) {
  const hoursDisplay = useTransform(totalHours, (h) =>
    String(Math.round(h)).padStart(2, '0'),
  )

  return (
    <div className="absolute bottom-5 right-5 sm:bottom-7 sm:right-10 lg:right-16 z-[5] pointer-events-none">
      <div
        className="px-4 py-3 rounded-sm shadow-card min-w-[150px]"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-label="Hours of labour invested in this piece"
        style={{
          background: 'var(--surface-raised)',
          border: '1px solid rgba(34,27,18,0.15)',
        }}
      >
        <p
          className="text-[9px] font-semibold uppercase text-ink/55 mb-1.5"
          style={{ letterSpacing: '0.32em' }}
        >
          Labour Ledger
        </p>
        <div className="flex items-baseline gap-2">
          <motion.span
            className="font-serif text-ink leading-none tabular-nums"
            style={{ fontSize: 36 }}
          >
            {reduceMotion ? String(TOTAL_HOURS).padStart(2, '0') : hoursDisplay}
          </motion.span>
          <span
            className="text-[10px] font-semibold uppercase text-ink/65"
            style={{ letterSpacing: '0.22em' }}
          >
            hours
          </span>
        </div>
        <ActiveChapterTag index={activeIndex} reduceMotion={reduceMotion} />
      </div>
    </div>
  )
}

function ActiveChapterTag({
  index,
  reduceMotion,
}: {
  index: MotionValue<number>
  reduceMotion: boolean
}) {
  const label = useTransform(index, (i): string => {
    const idx = Math.min(CHAPTERS.length - 1, Math.max(0, i))
    const c = CHAPTERS[idx]
    if (!c) return ''
    return `+${String(c.hours).padStart(2, '0')}h · ${c.title}`
  })
  return (
    <motion.p
      className="mt-1.5 text-[11px] font-serif text-ink/70 leading-tight"
    >
      {reduceMotion
        ? `+${String(CHAPTERS[4]!.hours).padStart(2, '0')}h · ${CHAPTERS[4]!.title}`
        : label}
    </motion.p>
  )
}

// ────────────────────────────────────────────────────────────────────
// ChapterCounter - top-right chrome, reads the active chapter index
// as a Roman numeral.
// ────────────────────────────────────────────────────────────────────
function ChapterCounter({
  index,
  reduceMotion,
}: {
  index: MotionValue<number>
  reduceMotion: boolean
}) {
  const display = useTransform(index, (i): string => {
    const idx = Math.min(ROMAN.length - 1, Math.max(0, i))
    return ROMAN[idx]!
  })
  return (
    <motion.span
      className="font-serif text-2xl text-ink"
      style={{ minWidth: 32, textAlign: 'right' }}
    >
      {reduceMotion ? ROMAN[0] : display}
    </motion.span>
  )
}

// ────────────────────────────────────────────────────────────────────
// EndPanel - the commerce hook.
// After 32 hours of watching the film, the visitor lands here on a
// fully-stocked product moment: thumbnail with Liquid Resin Shine,
// caption, price, and the full ActionPanel.
// ────────────────────────────────────────────────────────────────────
function EndPanel() {
  return (
    <div className="max-w-[1640px] mx-auto px-5 sm:px-10 lg:px-16">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ amount: 0.35, once: true }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center"
      >
        {/* Piece thumbnail - the only Liquid Resin Shine in the room.
            Documentary chapter media stayed matte; the piece you can
            actually buy gets the polish. Visual hierarchy by discipline. */}
        <div className="lg:col-span-5 flex justify-center lg:justify-end order-2 lg:order-1">
          <div className="resin-plate relative w-full max-w-[440px] aspect-[4/5]">
            <PictureImage
              src={PIECE.thumbnail.src}
              alt={PIECE.thumbnail.alt}
              fill
              sizes="(min-width: 1024px) 36vw, 90vw"
              loading="lazy"
              className="object-cover"
            />
            <div className="resin-specular" />
          </div>
        </div>

        {/* Editorial + ActionPanel */}
        <div className="lg:col-span-7 order-1 lg:order-2 max-w-xl">
          <div className="flex items-center gap-3 mb-5">
            <span
              aria-hidden
              className="h-px w-10"
              style={{ background: 'var(--accent-strong)' }}
            />
            <span
              className="text-[10px] font-semibold uppercase text-ink/65"
              style={{ letterSpacing: '0.36em' }}
            >
              32 hours · One piece
            </span>
          </div>

          <h2
            className="font-serif font-medium text-ink leading-[1.05] text-balance"
            style={{
              fontSize: 'clamp(40px, 5vw, 68px)',
              letterSpacing: '-0.005em',
            }}
          >
            This was{' '}
            <span className="gold-text">{PIECE.title}</span>.
          </h2>

          <p
            className="mt-5 text-[11px] uppercase text-ink/65"
            style={{ letterSpacing: '0.14em' }}
          >
            {PIECE.medium}
            <span aria-hidden className="text-ink/30 px-2">·</span>
            {PIECE.dimensions}
            <span aria-hidden className="text-ink/30 px-2">·</span>
            {PIECE.year}
          </p>

          <div className="mt-5 flex flex-wrap items-baseline gap-x-5 gap-y-1.5">
            <AvailabilityBadge availability={PIECE.availability} />
            {PIECE.price && (
              <p
                className="font-serif text-ink"
                style={{
                  fontSize: 'clamp(20px, 1.8vw, 28px)',
                  letterSpacing: '-0.005em',
                }}
              >
                {formatINR(PIECE.price.amount)}
              </p>
            )}
          </div>

          <p
            className="mt-6 font-serif text-ink/80 max-w-lg"
            style={{
              fontSize: 'clamp(16px, 1.2vw, 20px)',
              lineHeight: 1.55,
            }}
          >
            The piece you watched come together. Available for acquisition
            until it isn’t.
          </p>

          <div className="mt-8">
            <ActionPanel piece={PIECE} source="process_film" />
          </div>

          <div className="mt-10 pt-6 flex flex-wrap items-center gap-x-8 gap-y-3"
            style={{ borderTop: '1px solid rgba(34,27,18,0.10)' }}>
            <Link
              href={`/shop?category=${PIECE.category}`}
              className="group inline-flex items-center gap-2.5 text-sm font-semibold uppercase text-ink/70 hover:text-ink transition-colors duration-500"
              style={{ letterSpacing: '0.14em' }}
            >
              See more {PIECE.category} pieces
              <ArrowUpRight
                className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-500"
                aria-hidden
              />
            </Link>
            <Link
              href={`/process-film/${FILM_SLUG}`}
              className="group inline-flex items-center gap-2.5 text-sm font-semibold uppercase text-ink/55 hover:text-ink/85 transition-colors duration-500"
              style={{ letterSpacing: '0.14em' }}
            >
              Watch the full film
              <ArrowUpRight
                className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-500"
                aria-hidden
              />
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
