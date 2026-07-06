'use client'

/**
 * StandaloneFilm - the linear-scroll variant of Room 04.
 *
 * Reuses the shared Process Film data (CHAPTERS, PIECE) but rendered as a
 * simple top-to-bottom page instead of a sticky-stage scroll-bound room.
 * Each chapter is its own section; media autoplays on every viewport
 * (including mobile, since visitors here have explicitly opted in by
 * tapping "Watch the full film"). Closes with the same commerce End Panel
 * the homepage room uses.
 *
 * Blueprint chapters render the same typographic placeholder card as the
 * homepage room - same visual language, same upgrade path. The studio's
 * photography work feeds both surfaces simultaneously.
 */

import Link from 'next/link'
import PictureImage from '@/components/PictureImage'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import {
  CHAPTERS,
  PIECE,
  TOTAL_HOURS,
  type Chapter,
  type ChapterMedia,
} from '@/components/marketing/v2/shared/processFilmData'
import {
  ActionPanel,
  AvailabilityBadge,
} from '@/components/marketing/v2/shared/actions'
import { formatINR } from '@/components/marketing/v2/shared/analytics'

export default function StandaloneFilm() {
  return (
    <main className="relative w-full bg-plum text-ink">
      {/* Page header - back to studio + film title */}
      <header className="relative w-full pt-24 lg:pt-32 pb-12 lg:pb-16">
        <div className="max-w-3xl mx-auto px-5 sm:px-8 lg:px-10">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase text-ink/65 hover:text-ink transition-colors duration-500"
            style={{ letterSpacing: '0.28em' }}
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
            Back to the studio
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="mt-10"
          >
            <div className="flex items-center gap-3 mb-5">
              <span
                aria-hidden
                className="h-px w-10"
                style={{ background: 'var(--accent-strong)' }}
              />
              <span
                className="text-[11px] font-semibold uppercase text-ink/65"
                style={{ letterSpacing: '0.36em' }}
              >
                Process Film
              </span>
            </div>
            <h1
              className="font-serif font-medium text-ink leading-[1.04] tracking-[-0.005em] text-balance"
              style={{ fontSize: 'clamp(40px, 6vw, 88px)' }}
            >
              The Making of{' '}
              <span className="italic gold-text">{PIECE.title}</span>
            </h1>
            <p
              className="mt-6 text-ink/75 max-w-xl"
              style={{
                fontSize: 'clamp(15px, 1.1vw, 19px)',
                lineHeight: 1.65,
              }}
            >
              {TOTAL_HOURS} hours of work, documented in five chapters - concept
              to delivery. A layered resin pour on birch panel, finished with
              24-karat gold leaf. Filmed in the studio, Hyderabad.
            </p>
          </motion.div>
        </div>
      </header>

      {/* Editorial rule */}
      <div aria-hidden className="max-w-3xl mx-auto px-5 sm:px-8 lg:px-10">
        <div
          className="h-px"
          style={{
            background:
              'linear-gradient(to right, transparent, rgba(34,27,18,0.18), rgba(200,150,47,0.30), transparent)',
          }}
        />
      </div>

      {/* Chapters - linear sequence */}
      <div className="py-8">
        {CHAPTERS.map((chapter, i) => (
          <StandaloneChapter
            key={chapter.no}
            chapter={chapter}
            isFirst={i === 0}
          />
        ))}
      </div>

      {/* End Panel - same commerce hook as the homepage room */}
      <section
        className="relative w-full pt-16 lg:pt-24 pb-20 lg:pb-28"
        style={{ background: 'rgb(var(--surface-sunken-rgb))' }}
      >
        <div className="max-w-[1640px] mx-auto px-5 sm:px-10 lg:px-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ amount: 0.35, once: true }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center"
          >
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
                  {TOTAL_HOURS} hours · One piece
                </span>
              </div>

              <h2
                className="font-serif font-medium text-ink leading-[1.05] text-balance"
                style={{
                  fontSize: 'clamp(36px, 4.4vw, 60px)',
                  letterSpacing: '-0.005em',
                }}
              >
                This was{' '}
                <span className="italic gold-text">{PIECE.title}</span>.
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
                className="mt-6 font-serif italic text-ink/80 max-w-lg"
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
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  )
}

// ────────────────────────────────────────────────────────────────────
// StandaloneChapter - one chapter, linear-scroll, video autoplays on
// every viewport (including mobile, since visitors opted in here).
// ────────────────────────────────────────────────────────────────────
function StandaloneChapter({
  chapter,
  isFirst,
}: {
  chapter: Chapter
  isFirst: boolean
}) {
  return (
    <section
      aria-labelledby={`sf-chapter-${chapter.no}-title`}
      className="relative w-full py-14 lg:py-24"
    >
      <div className="max-w-5xl mx-auto px-5 sm:px-8 lg:px-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Editorial */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ amount: 0.3, once: true }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-5 order-2 lg:order-1"
          >
            <div className="flex items-center gap-3 mb-4">
              <span
                className="text-[10px] font-semibold uppercase text-ink/65"
                style={{ letterSpacing: '0.36em' }}
              >
                {chapter.eyebrow}
              </span>
              <span aria-hidden className="h-px w-6 bg-ink/30" />
            </div>
            <h2
              id={`sf-chapter-${chapter.no}-title`}
              className="font-serif font-medium text-ink uppercase leading-[1.05] tracking-[-0.005em] text-balance"
              style={{ fontSize: 'clamp(32px, 4.5vw, 64px)' }}
            >
              {chapter.title}
            </h2>
            <p
              className="mt-2 text-[10px] font-semibold uppercase text-ink/55"
              style={{ letterSpacing: '0.28em' }}
            >
              +{String(chapter.hours).padStart(2, '0')} hours · {String(chapter.cumulativeHours).padStart(2, '0')} cumulative
            </p>
            <p
              className="mt-6 text-ink/75 max-w-md"
              style={{ fontSize: 16, lineHeight: 1.7 }}
            >
              {chapter.body}
            </p>
            {chapter.pullQuote && (
              <p
                className="mt-6 font-serif italic text-ink/80 max-w-md border-l-2 pl-5"
                style={{
                  borderColor: 'var(--accent-strong)',
                  fontSize: 'clamp(16px, 1.3vw, 20px)',
                  lineHeight: 1.5,
                }}
              >
                “{chapter.pullQuote}”
              </p>
            )}
          </motion.div>

          {/* Media */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ amount: 0.3, once: true }}
            transition={{
              duration: 0.8,
              delay: 0.08,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="lg:col-span-7 order-1 lg:order-2"
          >
            <div
              className="relative w-full aspect-[4/5] sm:aspect-[3/4] lg:aspect-[4/5] rounded-sm overflow-hidden"
              style={{ border: '1px solid rgba(34,27,18,0.08)' }}
            >
              <StandaloneMedia
                media={chapter.media}
                chapter={chapter}
                eager={isFirst}
              />
              {/* Shot caption - pinned to bottom edge */}
              <div
                aria-hidden
                className="absolute inset-x-0 bottom-0 z-[3] px-5 py-3"
                style={{
                  background:
                    'linear-gradient(to top, rgba(20,16,10,0.55) 0%, transparent 100%)',
                }}
              />
              <p
                className="absolute inset-x-0 bottom-3 z-[4] px-5 text-[10px] font-semibold uppercase text-white/90"
                style={{ letterSpacing: '0.28em' }}
              >
                {chapter.shotCaption}
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

function StandaloneMedia({
  media,
  chapter,
  eager,
}: {
  media: ChapterMedia
  chapter: Chapter
  eager: boolean
}) {
  if (media.type === 'blueprint') {
    return (
      <div
        className="absolute inset-0 flex items-center justify-center px-8 py-12"
        style={{ background: 'rgb(var(--surface-sunken-rgb))' }}
      >
        <div
          aria-hidden
          className="absolute inset-0 bg-paper-grain opacity-[0.14] mix-blend-overlay pointer-events-none"
        />
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 80% 70% at 50% 50%, rgba(232,194,90,0.12) 0%, transparent 70%)',
          }}
        />
        <span
          aria-hidden
          className="absolute font-serif italic text-ink/[0.05] select-none pointer-events-none leading-none"
          style={{
            fontSize: 'clamp(220px, 36vw, 460px)',
            letterSpacing: '-0.04em',
          }}
        >
          {chapter.no}
        </span>
        <div className="relative z-[2] text-center max-w-md">
          <p
            className="text-[10px] font-semibold uppercase text-ink/55 mb-4"
            style={{ letterSpacing: '0.36em' }}
          >
            Plate - Chapter {chapter.no}
          </p>
          <h3
            className="font-serif italic text-ink leading-[1.04] text-balance"
            style={{ fontSize: 'clamp(40px, 4.5vw, 72px)' }}
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
  if (media.type === 'still') {
    return (
      <>
        <PictureImage
          src={media.src}
          alt={media.alt}
          fill
          sizes="(min-width: 1024px) 55vw, 100vw"
          priority={eager}
          loading={eager ? 'eager' : 'lazy'}
          className="object-cover"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-paper-grain opacity-[0.04] mix-blend-overlay pointer-events-none"
        />
      </>
    )
  }
  // video - autoplay on all viewports here (visitor opted in)
  return (
    <>
      <video
        autoPlay
        muted
        loop
        playsInline
        preload={eager ? 'auto' : 'metadata'}
        poster={media.poster}
        aria-label={media.alt}
        className="absolute inset-0 w-full h-full object-cover"
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
