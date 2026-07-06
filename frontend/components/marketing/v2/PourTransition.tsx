'use client'

/**
 * PourTransition - the corridor between rooms.
 *
 * A scroll-bound resin sheet that pours down across the viewport as the
 * user scrolls through the boundary between two rooms. The previous room
 * recedes, an editorial label of the next room rises through the ink,
 * and the resin retreats off the bottom of the viewport to reveal the
 * incoming room. This is the page-as-exhibition moment - the corridor
 * between gallery wings - and is intentionally one viewport tall.
 *
 * Why scroll-bound (not trigger-fire):
 *   A scroll-bound animation lets the visitor *feel* the resin under
 *   their finger / wheel. Triggered animations interrupt the user; a
 *   scrubbed pour keeps the user in control while delivering the
 *   cinematic moment. This is the difference between a transition that
 *   "happens to you" and one you "walk through."
 *
 * Performance:
 *   - The pour shape is a *static* SVG path. We only animate
 *     `transform: translateY` on a wrapper - GPU-composited, no layout,
 *     no paint past the initial. 60fps on mid-range Android.
 *   - The sticky stage is one element. The label uses opacity + y.
 *   - useReducedMotion → the sheet is permanently parked off-screen so
 *     scrolling through reads as a quiet ivory break, not a wash.
 *
 * Visual design:
 *   - The resin body is a deep espresso ink (matches your --text token)
 *     with a subtle vertical gradient (slightly lighter near the top,
 *     deeper toward the bottom - simulates the "fresh" pour catching
 *     light at the meniscus and pooling darker below).
 *   - A single hairline gold catchlight rides the meniscus - this is
 *     the "light caught on the wet edge" detail that makes it read as
 *     resin, not as a black wipe.
 *   - The meniscus path is a viscous, asymmetric curve (4 broad Beziers
 *     across the viewport). Not jagged, not symmetric, not uniform -
 *     irregular like a real pour.
 *
 * Use:
 *   <Room A />
 *   <PourTransition label="The Collections" eyebrow="Room 03" />
 *   <Room B />
 */

import { useRef } from 'react'
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion'

interface PourTransitionProps {
  /** Editorial title shown at the peak of the pour. Cormorant. */
  label?: string
  /** Small caps eyebrow above the label. e.g. "Room 03" */
  eyebrow?: string
  /** Backdrop tone behind the sheet - picks up the destination room's mood.
   *  'ivory'  = warm sand wash (default, for entering ivory rooms)
   *  'ink'    = deep espresso wash (for entering dark rooms)
   *  'sand'   = ochre wash (for entering the wedding / festival rooms) */
  tone?: 'ivory' | 'ink' | 'sand'
  className?: string
}

// Pre-computed viscous meniscus path. viewBox is 1920×1080; the SVG
// scales via preserveAspectRatio="none" so this curve stretches across
// any viewport while the path itself stays static (GPU-friendly).
//
// Shape language: 4 broad asymmetric Beziers form an irregular wet edge.
// Peaks and troughs intentionally NOT evenly spaced - a real pour is
// never uniform. The path closes back into a full-viewport ink body.
const POUR_PATH = `
  M 0 96
  C 280 28, 560 132, 820 72
  C 1060 18, 1320 118, 1560 58
  C 1720 22, 1860 88, 1920 68
  L 1920 1080
  L 0 1080
  Z
`.trim()

// Same curve as a stroke-only path for the gold catchlight on the meniscus.
const POUR_EDGE = `
  M 0 96
  C 280 28, 560 132, 820 72
  C 1060 18, 1320 118, 1560 58
  C 1720 22, 1860 88, 1920 68
`.trim()

const TONE_BACKDROP: Record<NonNullable<PourTransitionProps['tone']>, string> = {
  ivory:
    'radial-gradient(ellipse 80% 70% at 50% 60%, rgba(242,235,221,0.95) 0%, rgba(251,248,242,1) 70%)',
  ink:
    'radial-gradient(ellipse 80% 70% at 50% 50%, rgba(34,27,18,0.96) 0%, rgba(20,16,10,1) 70%)',
  sand:
    'radial-gradient(ellipse 80% 70% at 50% 60%, rgba(232,212,170,0.55) 0%, rgba(242,235,221,1) 70%)',
}

export default function PourTransition({
  label,
  eyebrow,
  tone = 'ivory',
  className,
}: PourTransitionProps) {
  const ref = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()

  // Scroll progress through the bridge. 0 when bridge bottom hits viewport
  // bottom; 1 when bridge top exits viewport. Linear scrub.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })

  // Resin sheet translateY: -100% (above viewport) → +100% (below viewport).
  // Sheet height matches viewport, so meniscus passes through top at -100,
  // covers viewport at 0, and exits past bottom at +100.
  const sheetY = useTransform(scrollYProgress, [0, 1], ['-100%', '100%'])

  // Editorial label visibility: appears as the sheet covers the viewport,
  // peaks at full coverage, fades as the sheet begins retreating.
  const labelOpacity = useTransform(
    scrollYProgress,
    [0.30, 0.46, 0.58, 0.72],
    [0, 1, 1, 0],
  )
  const labelY = useTransform(
    scrollYProgress,
    [0.30, 0.46, 0.58, 0.72],
    [20, 0, 0, -20],
  )

  // Subtle gold dust below the meniscus - opacity follows the sheet so the
  // shimmer only exists while resin is on-screen.
  const shimmerOpacity = useTransform(
    scrollYProgress,
    [0.18, 0.5, 0.82],
    [0, 0.5, 0],
  )

  const labelTextColor = tone === 'ink' ? '#FBF8F2' : '#FBF8F2'

  return (
    <section
      ref={ref}
      aria-hidden
      className={`relative w-full h-[100svh] ${className ?? ''}`}
      style={{ background: TONE_BACKDROP[tone] }}
    >
      <div className="sticky top-0 h-[100svh] w-full overflow-hidden">

        {/* ── Editorial label - peaks at full pour ─────────────── */}
        {(label || eyebrow) && (
          <motion.div
            style={{ opacity: labelOpacity, y: labelY }}
            className="absolute inset-x-0 top-1/2 -translate-y-1/2 z-[3]
                       flex flex-col items-center text-center px-6 select-none
                       will-change-transform"
          >
            {eyebrow && (
              <span
                className="text-[10px] font-semibold uppercase mb-5"
                style={{
                  letterSpacing: '0.36em',
                  color: 'rgba(232, 194, 90, 0.90)',
                }}
              >
                {eyebrow}
              </span>
            )}
            {label && (
              <p
                className="font-serif uppercase"
                style={{
                  color: labelTextColor,
                  fontSize: 'clamp(40px, 6.5vw, 96px)',
                  lineHeight: 1.04,
                  letterSpacing: '0.01em',
                  textShadow: '0 2px 28px rgba(0,0,0,0.55)',
                }}
              >
                {label}
              </p>
            )}
            {label && (
              <span
                aria-hidden
                className="block mx-auto mt-6 h-px"
                style={{
                  width: 64,
                  background:
                    'linear-gradient(90deg, transparent, rgba(232,194,90,0.85), transparent)',
                }}
              />
            )}
          </motion.div>
        )}

        {/* ── The resin sheet - GPU-driven translateY ──────────── */}
        <motion.div
          style={reduceMotion ? { y: '100%' } : { y: sheetY }}
          className="absolute inset-x-0 top-0 h-[100svh] z-[2] will-change-transform"
        >
          <svg
            viewBox="0 0 1920 1080"
            preserveAspectRatio="none"
            className="block w-full h-full"
            aria-hidden
          >
            <defs>
              {/* Resin body - vertical gradient. Slightly lighter near
                  the meniscus (light passes through the surface) and
                  deeper toward the bottom (pooled, less translucent). */}
              <linearGradient id="pour-body" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"  stopColor="#3A2C1B" />
                <stop offset="12%" stopColor="#231B11" />
                <stop offset="100%" stopColor="#15100A" />
              </linearGradient>
              {/* Soft inner haze near the meniscus - gives the
                  "wet, slightly translucent" read. */}
              <linearGradient id="pour-haze" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"  stopColor="rgba(232,194,90,0)" />
                <stop offset="6%"  stopColor="rgba(232,194,90,0.16)" />
                <stop offset="20%" stopColor="rgba(232,194,90,0)" />
              </linearGradient>
            </defs>

            {/* Body */}
            <path d={POUR_PATH} fill="url(#pour-body)" />
            {/* Translucent inner haze just under the meniscus */}
            <path d={POUR_PATH} fill="url(#pour-haze)" />

            {/* Meniscus catchlight - single hairline gold stroke on the
                wet edge. The detail that reads "resin," not "wipe." */}
            <path
              d={POUR_EDGE}
              fill="none"
              stroke="rgba(232, 194, 90, 0.78)"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
            {/* A second softer glow stroke, wider, lower opacity - adds
                a faint halo around the meniscus without going neon. */}
            <path
              d={POUR_EDGE}
              fill="none"
              stroke="rgba(255, 244, 210, 0.18)"
              strokeWidth="6"
              vectorEffect="non-scaling-stroke"
              style={{ filter: 'blur(2px)' }}
            />
          </svg>

          {/* Sparse gold-dust shimmer ribbon under the meniscus.
              Two thin horizontal gradient bars at low opacity that fade
              based on scroll progress. No particles, no JS loop - pure
              CSS. Reads as "specks suspended in the wet resin." */}
          {!reduceMotion && (
            <motion.div
              style={{ opacity: shimmerOpacity }}
              aria-hidden
              className="absolute inset-x-0 top-[8%] h-[18%] pointer-events-none"
            >
              <div
                className="absolute inset-x-0 top-0 h-px"
                style={{
                  background:
                    'linear-gradient(90deg, transparent 10%, rgba(232,194,90,0.55) 35%, rgba(255,244,210,0.4) 55%, transparent 90%)',
                  filter: 'blur(0.5px)',
                }}
              />
              <div
                className="absolute inset-x-0 top-[60%] h-px"
                style={{
                  background:
                    'linear-gradient(90deg, transparent 18%, rgba(232,194,90,0.35) 50%, transparent 82%)',
                  filter: 'blur(0.5px)',
                }}
              />
            </motion.div>
          )}
        </motion.div>
      </div>
    </section>
  )
}
