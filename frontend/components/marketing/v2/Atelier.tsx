'use client'

/**
 * Atelier — Room 02 of the Studio Vault.
 *
 * Not an About page. A scroll-bound, four-chapter emotional pause between
 * the Hero and the Collection Exhibition. Inspiration → Exploration →
 * Craftsmanship → Srilatha Art. A pinned stage; the light changes around
 * the visitor as they scroll. Chapters I–III read like a printed
 * monograph (uniform warm B&W). Chapter IV breaks the spell: the artist
 * arrives on a Liquid Resin plate, and her signature draws itself in.
 *
 * Asset notes:
 *   The chapter visuals reuse imagery in /public/Slideshow until the
 *   Atelier shoot lands. CHAPTER_IMG paths are at the top of the file
 *   so swapping in the real assets is a one-line change per chapter.
 *   Chapter IV should ultimately be an actual studio portrait of
 *   Srilatha — at that point, drop the file at /public/atelier/portrait.jpg
 *   and update CHAPTER_IMG[3].
 *
 *   The SIGNATURE_PATH is a stylised approximation of "Srilatha." When the
 *   real signature is digitised, export the artist's signature as a single
 *   stroke SVG path and paste the `d` attribute here.
 */

import { useRef } from 'react'
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
  type MotionValue,
} from 'framer-motion'
import PictureImage from '@/components/PictureImage'

// ── Chapter content ───────────────────────────────────────────────
// Editorial copy chosen to be short, image-led, and not biographical.
// Each chapter has: eyebrow, title, body, optional quote, image asset.
interface Chapter {
  no: string
  eyebrow: string
  title: string
  body: string
  quote?: string
  img: { src: string; alt: string }
}

const CHAPTERS: readonly Chapter[] = [
  {
    no: 'I',
    eyebrow: 'Chapter I',
    title: 'Inspiration',
    body:
      'A doorway in Hyderabad. A line of chalk before dawn. The kolam under bare feet. This is where the work begins — in tradition that was never archived, only walked through.',
    img: {
      src: '/Slideshow/04-kolam.jpg',
      alt: 'Inspiration — threshold kolam practice',
    },
  },
  {
    no: 'II',
    eyebrow: 'Chapter II',
    title: 'Exploration',
    body:
      'First paper. Then canvas. Then chalk, then resin, then mirror and clay. Every medium is a question; the studio is where we learn how to listen to the answer.',
    img: {
      src: '/Slideshow/02-dot-mandala.jpg',
      alt: 'Exploration — dot mandala studies',
    },
  },
  {
    no: 'III',
    eyebrow: 'Chapter III',
    title: 'Craftsmanship',
    body:
      'The pour takes six minutes. The cure takes seven days. The decision to use that pigment, this dust, took years. What you see hanging is the part that survived.',
    quote: 'Patience is the medium. Everything else is material.',
    img: {
      src: '/Slideshow/03-lippan.jpg',
      alt: 'Craftsmanship — lippan in progress',
    },
  },
  {
    no: 'IV',
    eyebrow: 'Chapter IV',
    title: 'Srilatha Art',
    body:
      'One studio in Hyderabad. One artist. Every piece signed, packed, and shipped from this room. Step into the wings — what hangs there began here.',
    img: {
      // TODO: replace with /atelier/portrait.jpg when the studio shoot lands.
      src: '/Slideshow/01-resin.jpg',
      alt: 'Srilatha at the studio — placeholder',
    },
  },
] as const

/**
 * A stylised single-stroke "Srilatha" mark. Drawn left-to-right with one
 * continuous path so Framer Motion's `pathLength` produces a single,
 * elegant draw-in. Replace with the artist's digitised signature later.
 *
 * viewBox 600 × 180 — the SVG scales responsively below.
 */
const SIGNATURE_PATH =
  'M 24 120 ' +
  'C 38 78, 70 56, 96 76 ' +
  'C 110 88, 96 116, 70 116 ' +
  'C 56 116, 50 108, 56 96 ' +
  'C 64 80, 110 70, 138 90 ' +
  'L 142 70 ' +
  'M 150 90 ' +
  'C 162 70, 178 70, 184 88 ' +
  'L 188 116 ' +
  'M 200 96 ' +
  'L 200 116 ' +
  'M 200 72 ' +
  'L 200 76 ' +
  'M 218 60 ' +
  'L 218 116 ' +
  'C 218 122, 224 122, 230 118 ' +
  'M 250 92 ' +
  'C 262 78, 280 80, 282 96 ' +
  'C 284 108, 268 116, 252 110 ' +
  'C 250 110, 252 124, 268 124 ' +
  'M 310 72 ' +
  'L 298 116 ' +
  'M 290 92 ' +
  'L 320 92 ' +
  'M 336 60 ' +
  'L 336 116 ' +
  'M 336 92 ' +
  'C 350 78, 372 80, 372 96 ' +
  'L 372 116 ' +
  'M 392 96 ' +
  'C 402 80, 422 80, 426 94 ' +
  'C 430 110, 408 118, 396 110 ' +
  'C 392 110, 396 124, 412 124 ' +
  'M 442 96 ' +
  'C 454 80, 476 82, 476 98 ' +
  'L 476 116 ' +
  'M 444 116 ' +
  'C 460 124, 476 122, 488 110'

/**
 * Build the per-chapter motion values from the master scrollYProgress.
 *
 *   Chapter i occupies sub-range [i * 0.25 → (i+1) * 0.25].
 *   Opacity ramps 0→1 over the first 30% of its slot, holds, then
 *   ramps 1→0 over the final 30% (overlaps with the next chapter's
 *   ramp-in — the crossfade).
 *   Image y-parallax shifts subtly within the slot (±24px).
 *
 * Returning hooks-derived motion values from a helper is fine because
 * the helper is called the same number of times in the same order on
 * every render (one per chapter, with stable index).
 */
function useChapterMotion(progress: MotionValue<number>, index: number) {
  const start = index * 0.25
  const end = start + 0.25
  // Crossfade ramps — each chapter fades IN over its first 30% and OUT
  // over its last 30%. The first chapter starts fully visible so the
  // room never opens blank; the last chapter never fades out so the
  // visitor lands on the artist.
  const fadeIn = index === 0 ? start : start + 0.05
  const holdIn = start + 0.08
  const holdOut = index === CHAPTERS.length - 1 ? end : end - 0.05
  const fadeOut = end

  const opacity = useTransform(
    progress,
    [fadeIn, holdIn, holdOut, fadeOut],
    [index === 0 ? 1 : 0, 1, 1, index === CHAPTERS.length - 1 ? 1 : 0],
  )

  // Image subtle parallax — settles down then drifts down through slot.
  const imageY = useTransform(progress, [start, end], [24, -24])

  // Copy enters from below (12px), settles, exits up (-12px).
  const copyY = useTransform(
    progress,
    [start, holdIn, holdOut, fadeOut],
    [14, 0, 0, -14],
  )

  return { opacity, imageY, copyY }
}

export default function Atelier() {
  const ref = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()

  const { scrollYProgress } = useScroll({
    target: ref,
    // Begin scrubbing when the section's top hits viewport top (sticky engages)
    // and end when the section's bottom hits viewport bottom.
    offset: ['start start', 'end end'],
  })

  // Chapter motion — order matters; one set of hooks per chapter, called
  // unconditionally so the hook count stays stable.
  const c0 = useChapterMotion(scrollYProgress, 0)
  const c1 = useChapterMotion(scrollYProgress, 1)
  const c2 = useChapterMotion(scrollYProgress, 2)
  const c3 = useChapterMotion(scrollYProgress, 3)
  const chapterMotion = [c0, c1, c2, c3]

  // Counter — discrete chapter index 0..3 driven by clamped scroll progress.
  const counter = useTransform(scrollYProgress, (p) =>
    Math.min(CHAPTERS.length - 1, Math.max(0, Math.floor(p * CHAPTERS.length))),
  )

  // Signature draw-in — locked to Chapter IV's sub-range. Starts faintly
  // (so the visitor can already see the contour ahead of the stroke) and
  // completes at progress 0.95 so the visitor lands on the finished mark.
  const sigPathLength = useTransform(scrollYProgress, [0.78, 0.95], [0, 1])
  const sigOpacity = useTransform(scrollYProgress, [0.75, 0.82], [0, 1])

  // Progress bar fill width — full bar length follows scroll.
  const progressWidth = useTransform(scrollYProgress, [0, 1], ['0%', '100%'])

  return (
    <section
      ref={ref}
      aria-label="The Atelier — meet the artist"
      className="relative w-full bg-plum"
      style={{ height: '300svh', minHeight: 1800 }}
    >
      {/* Pinned stage — sticky for the entire scroll arc */}
      <div className="sticky top-0 h-[100svh] w-full overflow-hidden">

        {/* Soft warm directional wash so the B&W stage doesn't read as cold */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            background:
              'radial-gradient(ellipse 80% 70% at 20% 30%, rgba(242,235,221,0.65) 0%, transparent 60%),' +
              'radial-gradient(ellipse 70% 60% at 90% 80%, rgba(200,150,47,0.10) 0%, transparent 60%)',
          }}
        />

        {/* ── Pinned chrome — sits above the stage layer ─────────── */}
        {/* Top-left: room title */}
        <div className="absolute top-8 lg:top-10 left-5 sm:left-10 lg:left-16 z-[6] pointer-events-none">
          <div className="flex items-center gap-4">
            <span aria-hidden className="h-px w-10 bg-ink/50" />
            <span
              className="text-[11px] font-semibold uppercase text-ink/70"
              style={{ letterSpacing: '0.32em' }}
            >
              Room 02 — The Atelier
            </span>
          </div>
        </div>

        {/* Top-right: chapter counter (roman numerals) */}
        <div className="absolute top-8 lg:top-10 right-5 sm:right-10 lg:right-16 z-[6] flex items-center gap-3 pointer-events-none">
          <motion.span
            className="font-serif text-2xl text-ink"
            style={{ minWidth: 28, textAlign: 'right' }}
          >
            <RomanIndex value={counter} />
          </motion.span>
          <span aria-hidden className="h-px w-6 bg-ink/40" />
          <span className="font-serif text-sm text-ink/55">IV</span>
        </div>

        {/* ── Editorial split grid ────────────────────────────────── */}
        <div className="relative z-[3] h-full w-full">
          <div className="h-full max-w-[1640px] mx-auto px-5 sm:px-10 lg:px-16 pt-24 lg:pt-32 pb-28 lg:pb-28">
            <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16">

              {/* LEFT — chapter copy stage (sticky stacked) */}
              <div className="lg:col-span-5 relative flex flex-col justify-center order-2 lg:order-1 min-h-[36svh] lg:min-h-0">
                {CHAPTERS.map((chap, i) => (
                  <motion.div
                    key={chap.no}
                    style={
                      reduceMotion
                        ? { opacity: i === 0 ? 1 : 0 }
                        : {
                            opacity: chapterMotion[i]!.opacity,
                            y: chapterMotion[i]!.copyY,
                          }
                    }
                    className="absolute inset-0 flex flex-col justify-center max-w-xl will-change-transform"
                    aria-hidden={i !== 0 || undefined}
                  >
                    <div className="flex items-center gap-3 mb-5">
                      <span
                        className="text-[10px] font-semibold uppercase text-ink/65"
                        style={{ letterSpacing: '0.36em' }}
                      >
                        {chap.eyebrow}
                      </span>
                      <span aria-hidden className="h-px w-6 bg-ink/30" />
                    </div>
                    <h2
                      className="font-serif font-medium text-ink uppercase leading-[1.02] tracking-[-0.01em]"
                      style={{ fontSize: 'clamp(40px, 6vw, 96px)' }}
                    >
                      {chap.title}
                    </h2>
                    <p
                      className="mt-6 text-ink/75 max-w-lg"
                      style={{
                        fontSize: 'clamp(15px, 1.05vw, 18px)',
                        lineHeight: 1.7,
                      }}
                    >
                      {chap.body}
                    </p>
                    {chap.quote && (
                      <p
                        className="mt-6 font-serif italic text-ink/80 max-w-md border-l-2 border-[color:var(--accent-strong)] pl-5"
                        style={{
                          fontSize: 'clamp(17px, 1.4vw, 22px)',
                          lineHeight: 1.5,
                        }}
                      >
                        “{chap.quote}”
                      </p>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* RIGHT — visual stage */}
              <div className="lg:col-span-7 relative order-1 lg:order-2 flex items-center justify-center">
                {/* Stacked chapter visuals — B&W monograph treatment on
                    chapters I–III; Chapter IV ascends to the resin plate. */}
                <div className="relative w-full max-w-[760px] aspect-[4/5]">
                  {CHAPTERS.map((chap, i) => {
                    const isFinal = i === CHAPTERS.length - 1
                    const m = chapterMotion[i]!
                    return (
                      <motion.div
                        key={chap.no}
                        style={
                          reduceMotion
                            ? { opacity: i === 0 ? 1 : 0 }
                            : { opacity: m.opacity, y: m.imageY }
                        }
                        className={`absolute inset-0 will-change-transform ${
                          isFinal ? 'resin-plate' : ''
                        }`}
                        aria-hidden={i !== 0 || undefined}
                      >
                        {/* Frame around chapters I–III — printed-monograph
                            thin gold rule, no gloss; the polish is reserved
                            for the artist reveal in chapter IV. */}
                        {!isFinal && (
                          <div
                            aria-hidden
                            className="absolute inset-4 z-[3] pointer-events-none border"
                            style={{ borderColor: 'rgba(200,150,47,0.35)' }}
                          />
                        )}

                        <div
                          className="absolute inset-0 overflow-hidden"
                          style={{
                            // B&W monograph filter on documentary chapters.
                            // Chapter IV reads in colour — the artist is
                            // present, not archival.
                            filter: isFinal
                              ? 'none'
                              : 'grayscale(1) sepia(0.10) contrast(1.06) brightness(0.94)',
                          }}
                        >
                          <PictureImage
                            src={chap.img.src}
                            alt={chap.img.alt}
                            fill
                            sizes="(min-width: 1024px) 55vw, 100vw"
                            // All four preload eagerly — the section crossfades
                            // through all of them and lazy-loading would risk
                            // pop-in mid-scrub.
                            priority={i === 0}
                            loading={i === 0 ? 'eager' : 'eager'}
                            className="object-cover"
                          />
                        </div>

                        {/* Chapter IV — signature draw-in overlay */}
                        {isFinal && (
                          <motion.div
                            style={{ opacity: sigOpacity }}
                            className="absolute inset-x-0 bottom-0 z-[6] flex items-end justify-center pb-8 pointer-events-none"
                          >
                            <svg
                              viewBox="0 0 600 180"
                              className="w-[78%] max-w-[420px] h-auto"
                              aria-hidden
                            >
                              {/* Soft halo behind the stroke for legibility on
                                  varied photographic backgrounds. */}
                              <motion.path
                                d={SIGNATURE_PATH}
                                fill="none"
                                stroke="rgba(255,244,210,0.55)"
                                strokeWidth={9}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={
                                  reduceMotion
                                    ? { pathLength: 1 }
                                    : { pathLength: sigPathLength }
                                }
                                vectorEffect="non-scaling-stroke"
                                opacity={0.6}
                              />
                              {/* The signature stroke itself — ink ribbon with
                                  a hairline gold core for refinement. */}
                              <motion.path
                                d={SIGNATURE_PATH}
                                fill="none"
                                stroke="#FBF8F2"
                                strokeWidth={3}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={
                                  reduceMotion
                                    ? { pathLength: 1 }
                                    : { pathLength: sigPathLength }
                                }
                                vectorEffect="non-scaling-stroke"
                              />
                              <motion.path
                                d={SIGNATURE_PATH}
                                fill="none"
                                stroke="rgba(232,194,90,0.85)"
                                strokeWidth={1}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={
                                  reduceMotion
                                    ? { pathLength: 1 }
                                    : { pathLength: sigPathLength }
                                }
                                vectorEffect="non-scaling-stroke"
                              />
                            </svg>
                          </motion.div>
                        )}

                        {/* Chapter IV — specular layer on the plate */}
                        {isFinal && <div className="resin-specular" />}
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Bottom progress bar ─────────────────────────────────── */}
        <div className="absolute inset-x-0 bottom-6 lg:bottom-8 z-[5] flex items-center justify-center gap-3 pointer-events-none px-5">
          <div className="relative h-px w-40 sm:w-56 bg-ink/15 overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 bg-ink"
              style={reduceMotion ? { width: '100%' } : { width: progressWidth }}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── Tiny presentational helper — renders the active chapter as a
   roman numeral driven by the discrete counter MotionValue. Lives in
   the same file because it's nowhere else needed. */
function RomanIndex({ value }: { value: MotionValue<number> }) {
  const ROMAN: readonly string[] = ['I', 'II', 'III', 'IV']
  const idx = useTransform(
    value,
    (v): string => ROMAN[Math.min(3, Math.max(0, v))]!,
  )
  return <motion.span>{idx}</motion.span>
}
