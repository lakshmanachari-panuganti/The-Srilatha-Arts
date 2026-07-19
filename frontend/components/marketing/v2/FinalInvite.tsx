'use client'

/**
 * FinalInvite — Room 09 of the Studio Vault. The closing room.
 *
 * Two phases, one section:
 *
 *   PHASE A — The Closing Mandala (sticky stage, ~150svh of scroll)
 *     A blank ivory room. The kolam builds itself as the visitor scrolls:
 *       · the puḷḷi (dot grid) settles in first — the traditional
 *         foundation of every threshold drawing,
 *       · a single continuous line threads the lotus / petal pattern
 *         through the dots,
 *       · gold-leaf accents settle at the petal tips and the centre — the
 *         finishing strokes that mark the work as complete.
 *     The closing headline rises as the mandala completes. The room ends
 *     with an explicit museum bookend: "End of Exhibition I — 2026".
 *
 *   PHASE B — The Invitation (natural-flow, ~100svh)
 *     The page breathes out. A quiet bridge line, then three editorial
 *     invitation rows at equal weight — WhatsApp, Instagram, Commission.
 *     Below: a small "return to the gallery" exit, then the colophon set
 *     like the inside back cover of a printed exhibition catalog.
 *
 * Disciplined absences (intentional, do not "fix" later):
 *   · no `.resin-plate` — the room is matte by design
 *   · no `.btn-resin` — primary-vs-secondary hierarchy would assert a sales preference
 *   · no form fields, no newsletter, no urgency, no upsell
 *   · no featured artwork — the mandala IS the artwork
 *
 * The "I want a piece of this in my home" feeling is earned by tone, not
 * by call-to-action volume.
 */

import { useRef } from 'react'
import Link from 'next/link'
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
} from 'framer-motion'
import { MessageCircle, Sparkles, ArrowUpRight } from 'lucide-react'
import InstagramIcon from '@/components/icons/InstagramIcon'
import { CONTACT, waLink, mailtoLink } from '@/lib/site-config'

// ────────────────────────────────────────────────────────────────────
// Kolam geometry
//
// viewBox 600 × 600, centre (300, 300).
//
// 5×5 puḷḷi (dot grid), spacing 60 — the traditional foundation. The
// dots settle in from the centre outward across the first 15% of scroll.
//
// Distance from centre is used to stagger the dot reveal so it reads
// as a hand laying them down ring-by-ring, not all at once.
// ────────────────────────────────────────────────────────────────────
type Pulli = { x: number; y: number; d: number }
const PULLI: Pulli[] = (() => {
  const out: Pulli[] = []
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const x = 180 + c * 60
      const y = 180 + r * 60
      const d = Math.hypot(x - 300, y - 300) // distance from centre
      out.push({ x, y, d })
    }
  }
  // Sort by distance so the JSX reveal order follows the visual order.
  return out.sort((a, b) => a.d - b.d)
})()
const PULLI_MAX_D = Math.max(...PULLI.map((p) => p.d))

// Eight-petal lotus, single continuous stroke. The path leaves and
// returns to the centre once per petal, threading through all 8
// cardinal + diagonal positions. Curves are hand-tuned (not algorithmic)
// so the line feels drawn, not generated.
const LOTUS_PATH =
  'M 300 300 ' +
  'C 320 230 285 140 300 80 C 315 140 280 230 300 300 ' + // top
  'C 360 245 410 195 441 159 C 405 225 355 280 300 300 ' + // top-right
  'C 365 280 460 285 500 300 C 470 315 365 320 300 300 ' + // right
  'C 355 355 410 405 441 441 C 405 405 360 355 300 300 ' + // bottom-right
  'C 280 370 285 460 300 520 C 315 460 320 370 300 300 ' + // bottom
  'C 240 355 195 405 159 441 C 195 405 245 355 300 300 ' + // bottom-left
  'C 235 320 130 315 100 300 C 130 285 235 280 300 300 ' + // left
  'C 240 245 195 195 159 159 C 195 195 245 245 300 300'    // top-left

// Outer containment ring at radius 270 — the "wall" around the lotus.
// Drawn as a single circle for a clean elegant ring.
const OUTER_R = 270

// Eight gold-leaf accents at the petal tips, plus one at centre.
const GOLD_ACCENTS: { x: number; y: number; r: number }[] = [
  { x: 300, y: 300, r: 7 },   // centre
  { x: 300, y: 80,  r: 4 },   // top
  { x: 441, y: 159, r: 4 },   // top-right
  { x: 500, y: 300, r: 4 },   // right
  { x: 441, y: 441, r: 4 },   // bottom-right
  { x: 300, y: 520, r: 4 },   // bottom
  { x: 159, y: 441, r: 4 },   // bottom-left
  { x: 100, y: 300, r: 4 },   // left
  { x: 159, y: 159, r: 4 },   // top-left
]

// ────────────────────────────────────────────────────────────────────
// External links — sourced from the centralised CONTACT constant.
// ────────────────────────────────────────────────────────────────────
const LINKS = {
  whatsapp: waLink("Hi Srilatha, I'd like to begin a conversation about a piece."),
  instagram: CONTACT.instagramUrl,
  commission: '/custom-order',
  email: mailtoLink('Inquiry from the Studio Vault'),
  instagramHandle: CONTACT.instagramHandleAt,
  emailDisplay: CONTACT.email,
  phoneDisplay: CONTACT.phoneDisplay,
}

export default function FinalInvite() {
  const phaseARef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()

  // Scroll progress through Phase A — the sticky mandala arc.
  const { scrollYProgress } = useScroll({
    target: phaseARef,
    offset: ['start start', 'end end'],
  })

  // Reveal schedule (progress windows):
  //   0.00 – 0.15  dot grid settles, staggered by distance from centre
  //   0.15 – 0.65  8-petal lotus draws (the long continuous stroke)
  //   0.50 – 0.80  outer ring draws
  //   0.78 – 0.95  gold accents settle at petal tips + centre
  //   0.62 – 0.95  headline rises into view, line by line
  //   0.90 – 1.00  closing colophon ("End of Exhibition I") fades in
  const lotusLength = useTransform(scrollYProgress, [0.15, 0.65], [0, 1])
  const outerLength = useTransform(scrollYProgress, [0.50, 0.80], [0, 1])
  const goldOpacity = useTransform(scrollYProgress, [0.78, 0.95], [0, 1])
  const line1Opacity = useTransform(scrollYProgress, [0.62, 0.78], [0, 1])
  const line1Y = useTransform(scrollYProgress, [0.62, 0.78], [16, 0])
  const line2Opacity = useTransform(scrollYProgress, [0.74, 0.88], [0, 1])
  const line2Y = useTransform(scrollYProgress, [0.74, 0.88], [16, 0])
  const bookendOpacity = useTransform(scrollYProgress, [0.90, 1.0], [0, 1])

  return (
    <section
      aria-label="Closing — The Invitation"
      className="relative w-full bg-plum"
    >
      {/* ────────────────────────────────────────────────────────────
          PHASE A — Sticky mandala stage
          ──────────────────────────────────────────────────────────── */}
      <div
        ref={phaseARef}
        className="relative w-full"
        style={{ height: '150svh', minHeight: 1100 }}
      >
        <div className="sticky top-0 h-[100svh] w-full overflow-hidden">

          {/* Warm directional wash — keeps the matte ivory ground from
              reading flat. Lighter at the top, faint gold pool below. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[1]"
            style={{
              background:
                'radial-gradient(ellipse 70% 50% at 50% 18%, rgba(255,251,238,0.85) 0%, transparent 60%),' +
                'radial-gradient(ellipse 70% 50% at 50% 90%, rgba(200,150,47,0.10) 0%, transparent 65%)',
            }}
          />

          {/* Top-left: room title */}
          <div className="absolute top-8 lg:top-10 left-5 sm:left-10 lg:left-16 z-[5] pointer-events-none">
            <div className="flex items-center gap-4">
              <span aria-hidden className="h-px w-10 bg-ink/50" />
              <span
                className="text-[11px] font-semibold uppercase text-ink/70"
                style={{ letterSpacing: '0.32em' }}
              >
                Room 09 — The Invitation
              </span>
            </div>
          </div>

          {/* Top-right: closing counter — IX of IX */}
          <div className="absolute top-8 lg:top-10 right-5 sm:right-10 lg:right-16 z-[5] flex items-center gap-3 pointer-events-none">
            <span className="font-serif text-2xl text-ink">IX</span>
            <span aria-hidden className="h-px w-6 bg-ink/40" />
            <span className="font-serif text-sm text-ink/55">IX</span>
          </div>

          {/* Stage contents — mandala centred, headline below */}
          <div className="relative z-[2] h-full w-full flex flex-col items-center justify-center px-5 sm:px-10 lg:px-16 pt-24 pb-20 lg:pt-28 lg:pb-24">

            {/* The mandala */}
            <div
              className="relative w-[min(72vw,520px)] aspect-square shrink-0"
              role="img"
              aria-label="A kolam mandala completing itself as the exhibition closes"
            >
              <svg
                viewBox="0 0 600 600"
                className="block w-full h-full"
                aria-hidden
              >
                {/* Layer 1 — puḷḷi (dot grid). Each dot fades in across
                    the first 15% of scroll, ordered by distance from
                    centre. We bake the per-dot motion value via a small
                    inline component so we can call hooks in a loop
                    without conditional structure. */}
                {PULLI.map((p, i) => (
                  <Pulli
                    key={`p-${i}`}
                    x={p.x}
                    y={p.y}
                    d={p.d}
                    maxD={PULLI_MAX_D}
                    progress={scrollYProgress}
                    reduce={!!reduceMotion}
                  />
                ))}

                {/* Layer 2 — the 8-petal lotus, single continuous stroke. */}
                <motion.path
                  d={LOTUS_PATH}
                  fill="none"
                  stroke="#facc15"
                  strokeWidth={1.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={reduceMotion ? { pathLength: 1 } : { pathLength: lotusLength }}
                  vectorEffect="non-scaling-stroke"
                />

                {/* Layer 3 — outer containment ring */}
                <motion.circle
                  cx={300}
                  cy={300}
                  r={OUTER_R}
                  fill="none"
                  stroke="#facc15"
                  strokeWidth={1.1}
                  style={reduceMotion ? { pathLength: 1 } : { pathLength: outerLength }}
                  vectorEffect="non-scaling-stroke"
                />

                {/* Layer 4 — gold-leaf accents at petal tips + centre.
                    Single opacity binding shared across the group; cheap. */}
                <motion.g
                  style={reduceMotion ? { opacity: 1 } : { opacity: goldOpacity }}
                >
                  {GOLD_ACCENTS.map((a, i) => (
                    <circle
                      key={`g-${i}`}
                      cx={a.x}
                      cy={a.y}
                      r={a.r}
                      fill="#C8962F"
                    />
                  ))}
                  {/* A soft glow ring around the centre dot for emphasis */}
                  <circle
                    cx={300}
                    cy={300}
                    r={14}
                    fill="none"
                    stroke="rgba(200,150,47,0.45)"
                    strokeWidth={1}
                  />
                </motion.g>
              </svg>
            </div>

            {/* Headline — two lines, word-staggered reveal as the mandala completes */}
            <div className="mt-10 lg:mt-14 text-center max-w-3xl">
              <motion.h2
                style={
                  reduceMotion
                    ? { opacity: 1 }
                    : { opacity: line1Opacity, y: line1Y }
                }
                className="font-serif font-medium text-ink uppercase leading-[1.05] tracking-[-0.005em]"
              >
                <span style={{ fontSize: 'clamp(34px, 4.6vw, 76px)', display: 'block' }}>
                  The exhibition is complete.
                </span>
              </motion.h2>
              <motion.p
                style={
                  reduceMotion
                    ? { opacity: 1 }
                    : { opacity: line2Opacity, y: line2Y }
                }
                className="mt-1 font-serif italic text-ink"
              >
                <span
                  className="gold-text"
                  style={{ fontSize: 'clamp(34px, 4.6vw, 76px)' }}
                >
                  Yours begins now.
                </span>
              </motion.p>
            </div>

            {/* Phase A bookend — fades in only at scroll's end */}
            <motion.p
              style={
                reduceMotion
                  ? { opacity: 1 }
                  : { opacity: bookendOpacity }
              }
              className="mt-8 text-[10px] font-semibold uppercase text-ink/55"
            >
              <span style={{ letterSpacing: '0.36em' }}>
                End of Exhibition I — 2026
              </span>
            </motion.p>
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────
          PHASE B — The Invitation (natural flow)
          ──────────────────────────────────────────────────────────── */}
      <div className="relative w-full pt-24 lg:pt-32 pb-16 lg:pb-20">
        <div className="max-w-3xl mx-auto px-5 sm:px-10 lg:px-12">

          {/* Bridge line — the quiet pivot from closing to invitation */}
          <motion.p
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ amount: 0.6, once: true }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="text-center font-serif italic text-ink/75"
            style={{
              fontSize: 'clamp(18px, 1.6vw, 26px)',
              lineHeight: 1.5,
            }}
          >
            Every piece begins as a conversation.
          </motion.p>

          {/* Decorative editorial rule */}
          <div aria-hidden className="mt-10 mb-10 flex items-center justify-center">
            <span className="h-px w-12 bg-ink/20" />
            <span
              className="mx-3 text-[color:var(--accent-strong)]"
              style={{ fontSize: 10, letterSpacing: '0.4em' }}
            >
              ✦
            </span>
            <span className="h-px w-12 bg-ink/20" />
          </div>

          {/* Three invitations — equal visual weight, no primary, no boxes.
              Each row is one editorial line + chevron. */}
          <ul className="flex flex-col">
            <InvitationRow
              num="01"
              kicker="On WhatsApp"
              label="Begin a conversation"
              href={LINKS.whatsapp}
              external
              icon={<MessageCircle className="w-4 h-4" aria-hidden />}
              ariaLabel="Open WhatsApp conversation with Srilatha Art"
              reduceMotion={!!reduceMotion}
            />
            <InvitationRow
              num="02"
              kicker="On Instagram"
              label="Follow the journey"
              href={LINKS.instagram}
              external
              icon={<InstagramIcon className="w-4 h-4" />}
              ariaLabel="Open Srilatha Art on Instagram"
              reduceMotion={!!reduceMotion}
            />
            <InvitationRow
              num="03"
              kicker="By appointment"
              label="Commission a piece"
              href={LINKS.commission}
              icon={<Sparkles className="w-4 h-4" aria-hidden />}
              ariaLabel="Begin a custom artwork commission"
              reduceMotion={!!reduceMotion}
            />
          </ul>

          {/* Quiet exit — the visitor who isn't ready to act */}
          <div className="mt-12 text-center">
            <Link
              href="/shop"
              className="group inline-flex items-center gap-2 text-sm text-ink/55 hover:text-ink transition-colors duration-500"
            >
              <span>Or, return to the gallery</span>
              <ArrowUpRight
                className="w-3.5 h-3.5 transition-transform duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                aria-hidden
              />
            </Link>
          </div>

          {/* Final editorial rule */}
          <div aria-hidden className="mt-16 mb-10 rule" />

          {/* Colophon — the inside back cover of the catalog */}
          <Colophon />
        </div>
      </div>
    </section>
  )
}

// ────────────────────────────────────────────────────────────────────
// A single dot in the puḷḷi grid. Lives in its own component so the
// useTransform hook is called consistently per element across renders.
// ────────────────────────────────────────────────────────────────────
function Pulli({
  x,
  y,
  d,
  maxD,
  progress,
  reduce,
}: {
  x: number
  y: number
  d: number
  maxD: number
  progress: ReturnType<typeof useScroll>['scrollYProgress']
  reduce: boolean
}) {
  // Centre dot lands at progress 0.00, outermost dot lands at 0.15.
  // Linear ramp by distance, plus a short fade-in window per dot.
  const start = (d / maxD) * 0.12
  const end = start + 0.04
  const opacity = useTransform(progress, [start, end], [0, 1])
  return (
    <motion.circle
      cx={x}
      cy={y}
      r={2.4}
      fill="rgba(34,27,18,0.72)"
      style={reduce ? { opacity: 1 } : { opacity }}
    />
  )
}

// ────────────────────────────────────────────────────────────────────
// InvitationRow — a single editorial-grade invitation line.
//
// One continuous interactive row: number · label · kicker · chevron.
// No box, no surface. On hover: chevron extends, a hairline gold rule
// slides in beneath the row, the row text shifts +2px right for the
// magnetic feel. Same affordance for keyboard focus.
// ────────────────────────────────────────────────────────────────────
function InvitationRow({
  num,
  label,
  kicker,
  href,
  external,
  icon,
  ariaLabel,
  reduceMotion: rm,
}: {
  num: string
  label: string
  kicker: string
  href: string
  external?: boolean
  icon: React.ReactNode
  ariaLabel: string
  reduceMotion: boolean
}) {
  const targetProps = external
    ? { target: '_blank', rel: 'noopener noreferrer' as const }
    : {}

  // For internal links, use Next Link; for external (WhatsApp / IG) use <a>.
  const inner = (
    <span className="group flex w-full items-center justify-between gap-4 py-6 sm:py-7 border-b border-ink/10">
      <span className="flex items-baseline gap-5 sm:gap-7">
        <span
          className="font-serif text-ink/45 text-xl sm:text-2xl shrink-0"
          style={{ minWidth: 32 }}
        >
          {num}
        </span>
        <span className="flex flex-col items-start">
          <span
            className={`font-serif font-medium text-ink leading-[1.05] tracking-[-0.005em] ${
              rm ? '' : 'transition-transform duration-500 group-hover:translate-x-1 group-focus-visible:translate-x-1'
            }`}
            style={{ fontSize: 'clamp(24px, 3.2vw, 44px)' }}
          >
            {label}
          </span>
          <span
            className="mt-1.5 text-[10px] font-semibold uppercase text-ink/55"
            style={{ letterSpacing: '0.28em' }}
          >
            {kicker}
          </span>
        </span>
      </span>
      <span className="flex items-center gap-3 shrink-0">
        <span
          className="hidden sm:inline-flex items-center justify-center w-10 h-10 rounded-full
                     border border-ink/15 text-ink/75
                     transition-all duration-500
                     group-hover:border-ink/45 group-hover:text-ink
                     group-focus-visible:border-ink/45 group-focus-visible:text-ink"
        >
          {icon}
        </span>
        <span
          aria-hidden
          className="h-px bg-ink/40 w-8 transition-all duration-500
                     group-hover:w-14 group-hover:bg-ink
                     group-focus-visible:w-14 group-focus-visible:bg-ink"
        />
      </span>
    </span>
  )

  return (
    <li>
      {external ? (
        <a
          href={href}
          aria-label={ariaLabel}
          className="block focus-visible:outline-none focus-visible:ring-2
                     focus-visible:ring-[color:var(--accent-strong)]
                     focus-visible:ring-offset-4 focus-visible:ring-offset-plum rounded-sm"
          {...targetProps}
        >
          {inner}
        </a>
      ) : (
        <Link
          href={href}
          aria-label={ariaLabel}
          className="block focus-visible:outline-none focus-visible:ring-2
                     focus-visible:ring-[color:var(--accent-strong)]
                     focus-visible:ring-offset-4 focus-visible:ring-offset-plum rounded-sm"
        >
          {inner}
        </Link>
      )}
    </li>
  )
}

// ────────────────────────────────────────────────────────────────────
// Colophon — the printed-catalog back page. Studio info, IG handle,
// email, copyright + final exhibition bookend.
// ────────────────────────────────────────────────────────────────────
function Colophon() {
  return (
    <div className="text-ink/65" style={{ letterSpacing: '0.04em' }}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-10">
        <div>
          <p
            className="text-[10px] font-semibold uppercase text-ink/55 mb-3"
            style={{ letterSpacing: '0.32em' }}
          >
            The Studio
          </p>
          <p className="text-sm text-ink">Srilatha Art</p>
          <p className="text-sm">Hyderabad, India</p>
          <p className="mt-3 text-[11px] uppercase" style={{ letterSpacing: '0.18em' }}>
            Open Mon – Sat · Visits by appointment
          </p>
        </div>
        <div>
          <p
            className="text-[10px] font-semibold uppercase text-ink/55 mb-3"
            style={{ letterSpacing: '0.32em' }}
          >
            Correspondence
          </p>
          <p className="text-sm">
            <a
              href={LINKS.email}
              className="text-ink hover:text-[color:var(--accent-strong)] transition-colors duration-500
                         underline-offset-4 hover:underline"
            >
              {LINKS.emailDisplay}
            </a>
          </p>
          <p className="text-sm mt-1">
            <a
              href={LINKS.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink hover:text-[color:var(--accent-strong)] transition-colors duration-500
                         underline-offset-4 hover:underline"
            >
              {LINKS.instagramHandle}
            </a>
          </p>
          <p className="text-sm mt-1 text-ink/70">{LINKS.phoneDisplay}</p>
        </div>
      </div>

      <div className="mt-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p
          className="text-[10px] font-semibold uppercase text-ink/50"
          style={{ letterSpacing: '0.32em' }}
        >
          © 2026 Srilatha Art · All works original
        </p>
        <p
          className="text-[10px] font-semibold uppercase text-[color:var(--accent-strong)]"
          style={{ letterSpacing: '0.36em' }}
        >
          End of Exhibition I — 2026
        </p>
      </div>
    </div>
  )
}
