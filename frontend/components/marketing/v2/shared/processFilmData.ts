/**
 * Process Film - Vermilion Tide data.
 *
 * Shared by the main Room 04 component (ProcessFilm.tsx) and the
 * standalone /process-film/vermilion-tide page so chapter content,
 * piece metadata, and the Labour Ledger hour breakdown live in one
 * place.
 *
 * Per-chapter media is graceful - each chapter declares its current
 * state independently. Ship today with all chapters as `blueprint`;
 * upgrade per chapter as photography or video arrives. No code
 * changes needed beyond editing this file.
 *
 *   blueprint  →  a typographic placeholder card. Looks like an
 *                  intentional printed plate divider, not a missing image.
 *   still      →  a single photograph. PictureImage handles WebP fallback.
 *   video      →  6–10 second muted loop. Desktop autoplays; mobile shows
 *                  the poster (the standalone /process-film/vermilion-tide
 *                  page autoplays on mobile too, for visitors on Wi-Fi).
 *
 * Hour breakdown (02 + 04 + 16 + 06 + 04 = 32) matches FeaturedWorks
 * Plate I's Time & Technique line verbatim. If Srilatha rebalances the
 * internal split to reflect her actual labour pattern, the sum must
 * remain 32 so the cross-room continuity holds.
 */

import type { ActionablePiece } from './actions'

export type ChapterMedia =
  | { type: 'blueprint' }
  | { type: 'still'; src: string; alt: string }
  | { type: 'video'; src: string; poster: string; alt: string }

export interface Chapter {
  no: 'I' | 'II' | 'III' | 'IV' | 'V'
  eyebrow: string
  title: string
  body: string
  /** Optional pull-quote - italic Cormorant with gold border-left.
   *  Use sparingly, at most two chapters across the five-chapter arc. */
  pullQuote?: string
  /** Hours added BY this chapter (the increment shown in the ledger pulse). */
  hours: number
  /** Running total at this chapter's completion. */
  cumulativeHours: number
  /** Single-line caption pinned to the bottom of the media frame. */
  shotCaption: string
  media: ChapterMedia
}

export const FILM_SLUG = 'vermilion-tide'

/**
 * The piece this film documents. Wired into the End Panel's ActionPanel.
 *
 * Keep these values in sync with FeaturedWorks Plate I (Vermilion Tide).
 * When products move to a real catalogue API, both rooms will fetch from
 * the same source and this duplication disappears.
 */
export const PIECE: ActionablePiece & {
  medium: string
  dimensions: string
  year: string
  thumbnail: { src: string; alt: string }
  category: string
} = {
  slug: 'vermilion-tide',
  title: 'Vermilion Tide',
  availability: 'available',
  price: { kind: 'exact', amount: 68000 },
  productId: 'vermilion-tide', // TODO: replace with the real catalogue ID
  medium: 'Resin & gold leaf on birch panel',
  dimensions: '22 × 30 in',
  year: '2026',
  thumbnail: {
    src: '/Slideshow/01-resin.jpg',
    alt: 'Vermilion Tide - resin and gold leaf wall piece on birch panel',
  },
  category: 'resin',
}

export const CHAPTERS: readonly Chapter[] = [
  {
    no: 'I',
    eyebrow: 'Chapter I',
    title: 'Concept',
    body:
      'Every piece starts with a place. A doorway, a memory, a colour seen at the end of a long day. The first hours are spent looking - not making.',
    hours: 2,
    cumulativeHours: 2,
    shotCaption: 'Reference moodboard - Visakhapatnam tide pools at sunset',
    media: { type: 'blueprint' },
  },
  {
    no: 'II',
    eyebrow: 'Chapter II',
    title: 'Sketch',
    body:
      'Layout, palette, dimensions. Three or four iterations on paper before the panel is touched. Most pieces die here. The ones that survive earn the right to be built.',
    pullQuote: 'Most pieces die here. The ones that survive earn the right to be built.',
    hours: 4,
    cumulativeHours: 6,
    shotCaption: 'Pigment trials on cold-press paper',
    media: { type: 'blueprint' },
  },
  {
    no: 'III',
    eyebrow: 'Chapter III',
    title: 'Crafting',
    body:
      'The pour, the layering, the wait. Days of work compressed into minutes of film. Resin cures slowly; the patience is the medium.',
    hours: 16,
    cumulativeHours: 22,
    shotCaption: 'First pour, t+12 min - pigment dispersing',
    media: { type: 'blueprint' },
  },
  {
    no: 'IV',
    eyebrow: 'Chapter IV',
    title: 'Finishing',
    body:
      'Gold leaf, sealant, the final inspection. Twenty different angles of light tested against the surface. Anything imperfect is sanded back and redone.',
    pullQuote: 'The piece tells you when it is finished.',
    hours: 6,
    cumulativeHours: 28,
    shotCaption: '24kt leaf, applied with a sable brush',
    media: { type: 'blueprint' },
  },
  {
    no: 'V',
    eyebrow: 'Chapter V',
    title: 'Delivery',
    body:
      'Hand-packed, hand-signed, hand-addressed. The piece leaves the studio with a card from the maker.',
    hours: 4,
    cumulativeHours: 32,
    shotCaption: 'Packed for delivery - Hyderabad → Bengaluru',
    media: { type: 'blueprint' },
  },
] as const

/**
 * Pre-computed scroll-progress breakpoints derived from CHAPTERS.
 *
 * Section is laid out as 80% sticky stage + 20% End Panel reveal.
 * The five chapters split the stage evenly (16% each).
 *
 *   PROGRESS_BREAKPOINTS  - input to useTransform for the Labour Ledger
 *   CUMULATIVE_HOURS      - output of the same useTransform
 *
 * Both arrays must have the same length and align: at progress
 * PROGRESS_BREAKPOINTS[i], the ledger reads CUMULATIVE_HOURS[i].
 */
export const CHAPTER_STAGE_END = 0.80
export const PROGRESS_BREAKPOINTS: readonly number[] = [
  0,
  CHAPTERS[0]!.no ? 0.16 : 0,
  0.32,
  0.48,
  0.64,
  0.80,
]
export const CUMULATIVE_HOURS_TIMELINE: readonly number[] = [
  0,
  CHAPTERS[0]!.cumulativeHours,
  CHAPTERS[1]!.cumulativeHours,
  CHAPTERS[2]!.cumulativeHours,
  CHAPTERS[3]!.cumulativeHours,
  CHAPTERS[4]!.cumulativeHours,
]

/** Total hours across all chapters - the climactic ledger value. */
export const TOTAL_HOURS = CHAPTERS[CHAPTERS.length - 1]!.cumulativeHours
