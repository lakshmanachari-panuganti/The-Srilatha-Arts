'use client'

/**
 * FeaturedWorks - Room 05 of the Studio Vault.
 *
 * Eight selected pieces, one per viewport, scroll-snap mandatory.
 * The plate carries one of two presentations:
 *
 *   · Wall Reveal - when work.room is defined: museum mount is the base
 *     layer; the in-room image sits above, masked via clip-path bound to
 *     a single CSS custom property `--reveal` (0 → 1) that the visitor
 *     drags. Default position is 0.6 - biased toward museum at rest, the
 *     in-room context teases on the right. Dragging left exposes more of
 *     the living space; dragging right returns to the gallery.
 *
 *   · Plinth - when work.room is absent: museum mount only. Same plate
 *     dimensions, same caption grammar, same chrome. No broken UI, no
 *     "missing image" tile.
 *
 * The room is fully functional with 0/8, 3/8, or 8/8 in-room photos. The
 * studio adds room.src per piece as its photography archive grows.
 *
 * Editorial restraint:
 *   - the `.resin-plate` primitive (top sheen, diagonal sweep, deep
 *     drop shadow) provides ambient surface motion. No additional
 *     parallax. No scroll-bound zoom. No cursor specular tracking - the
 *     drag interaction is the signature, nothing competes with it.
 *   - editorial captions read museum-card grammar: medium · dimensions ·
 *     year on one line, then materials + craft on quiet tabular rows.
 *   - the availability badge is letterpress, not a sales banner. The
 *     "Privately acquired" state is kept in the wing for social proof
 *     and pivots its inquiry CTA to a commission path.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import PictureImage from '@/components/PictureImage'
import { motion, useReducedMotion } from 'framer-motion'
import { ChevronLeft, ChevronRight, MessageCircle, ArrowUpRight, ArrowRight, ShoppingBag, Sparkles, Loader2 } from 'lucide-react'
import { useAddToCart } from '@/hooks/useAddToCart'
import { apiFetch } from '@/lib/api'
import type { Product } from '@/types'
import { waLink } from '@/lib/site-config'

// ────────────────────────────────────────────────────────────────────
// Analytics shim - pushes a typed event into window.dataLayer (GA4) and,
// when window.fbq is present, into Meta Pixel. No-op if neither is wired,
// so the room remains measurable as soon as either tag is installed.
//
// Future: when GA4 / Meta config is provisioned, add a Script tag in
// app/layout.tsx that loads gtag.js + fbq. This shim then "wakes up"
// automatically - no change needed in the room components.
// ────────────────────────────────────────────────────────────────────
type TrackEvent =
  | { name: 'view_item';        params: { item_id: string; item_name: string; price?: number } }
  | { name: 'add_to_cart';      params: { item_id: string; item_name: string; price?: number; source: 'featured_works' } }
  | { name: 'begin_checkout';   params: { item_id: string; item_name: string; price?: number; source: 'featured_works' } }
  | { name: 'select_item';      params: { item_id: string; item_name: string; source: 'featured_works' } }
  | { name: 'whatsapp_inquiry'; params: { item_id?: string; item_name: string; source: 'featured_works' } }
  | { name: 'commission_inquiry'; params: { item_id?: string; item_name: string; source: 'featured_works' } }
  | { name: 'reveal_drag';      params: { item_id?: string; item_name: string; final_position: number } }

interface DataLayerWindow extends Window {
  dataLayer?: Array<{ event: string; [k: string]: unknown }>
  fbq?: (action: string, eventName: string, params?: Record<string, unknown>) => void
}

function trackEvent(evt: TrackEvent): void {
  if (typeof window === 'undefined') return
  const w = window as DataLayerWindow

  // GA4 dataLayer
  if (Array.isArray(w.dataLayer)) {
    w.dataLayer.push({ event: evt.name, ...evt.params })
  }

  // Meta Pixel - map our internal names to the closest standard Meta events
  if (typeof w.fbq === 'function') {
    const META_MAP: Partial<Record<TrackEvent['name'], string>> = {
      view_item: 'ViewContent',
      add_to_cart: 'AddToCart',
      begin_checkout: 'InitiateCheckout',
      whatsapp_inquiry: 'Contact',
      commission_inquiry: 'Lead',
    }
    const metaName = META_MAP[evt.name]
    if (metaName) w.fbq('track', metaName, evt.params as Record<string, unknown>)
  }
}

// ────────────────────────────────────────────────────────────────────
// Data model
// ────────────────────────────────────────────────────────────────────
interface FeaturedWork {
  slug: string
  title: string
  medium: string
  dimensions: string
  year: string
  /** 1–2 sentence origin of the work, rendered as a serif pull. */
  inspiration: string
  /** Single-line list of materials, rendered in caption-museum style. */
  materials: string
  /** Craft signal: hours invested · technique. e.g. "32 hours · Layered Resin Pour". */
  timeAndTechnique: string
  availability:
    | 'available'         // Available for acquisition
    | 'reserved'          // Reserved (in escrow)
    | 'acquired'          // Privately acquired - pivots inquiry to commission
    | 'commission-only'   // Commission only - variations available
  /** Pricing. Omit on `acquired` pieces; required everywhere else.
   *  kind 'exact' for in-stock works, 'starting-from' for commissions. */
  price?: {
    kind: 'exact' | 'starting-from'
    amount: number              // INR rupees (whole units, no paise)
    currency?: 'INR'
  }
  /** Catalogue product ID. When present, the editorial column shows a
   *  "View Details" CTA that links to /product/{productId}. Omit for
   *  pieces that don't have a product page yet - only the WhatsApp /
   *  commission CTAs render. */
  productId?: string | number
  museum: { src: string; alt: string }
  /** Optional in-room layer. Presence activates the Wall Reveal interaction. */
  room?: {
    src: string
    alt: string
    source: 'client' | 'staged'
    location?: string
  }
  /** Optional WhatsApp message override. Defaults to a templated opener. */
  inquiryPrefill?: string
}

// Indian currency formatter - gives proper lakh comma grouping ("₹ 1,50,000")
// rather than en-US thousands ("₹150,000"). The narrow space after the ₹
// matches the editorial register elsewhere on the site.
function formatINR(amount: number): string {
  const f = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  })
  return f.format(amount).replace('₹', '₹ ')
}

// ────────────────────────────────────────────────────────────────────
// The eight pieces
//
// Replace placeholders as production photography lands. Each entry's
// imagery and copy is a one-line swap. Pieces VI–VIII reuse imagery
// from the existing /Slideshow/ assets pending real photographs.
// ────────────────────────────────────────────────────────────────────
// NOTE on productId fields: these MUST match the IDs in your product
// catalogue (the /product/[id] route resolves real Product objects). The
// strings below are placeholders. Map each featured piece to its actual
// catalogue ID before launch, otherwise View Details / Add to Cart / Buy
// Now will land on a 404. Pieces that don't yet exist in the catalogue
// can omit productId - the wing will render those with only the inquiry
// CTAs (no cart actions) and not break.
const WORKS: readonly FeaturedWork[] = [
  {
    slug: 'vermilion-tide',
    title: 'Vermilion Tide',
    medium: 'Resin & gold leaf on birch panel',
    dimensions: '22 × 30 in',
    year: '2026',
    inspiration:
      'The tide pools of Visakhapatnam at sunset - saturated red against wet black volcanic rock.',
    materials: 'Pigmented epoxy resin · 24kt gold leaf · birch ply · lacquer finish',
    timeAndTechnique: '32 hours · Layered Resin Pour',
    availability: 'available',
    price: { kind: 'exact', amount: 68000 },
    productId: 'vermilion-tide', // TODO: replace with real catalogue ID
    museum: {
      src: '/Slideshow/01-resin.jpg',
      alt: 'Vermilion Tide - resin and gold leaf wall piece on birch panel',
    },
    // DEMO - using the same image as a stand-in so the Wall Reveal mechanic
    // is visible on first preview. Replace with a real interior photograph
    // (client or studio-staged) when available.
    room: {
      src: '/Slideshow/01-resin.jpg',
      alt: 'Vermilion Tide installed - placeholder for in-room photography',
      source: 'staged',
      location: 'Studio',
    },
  },
  {
    slug: 'concentric-devotion',
    title: 'Concentric Devotion',
    medium: 'Acrylic & ink on canvas',
    dimensions: '24 × 24 in',
    year: '2025',
    inspiration:
      'Six rings, six prayers - drawn at dawn, one dot at a time.',
    materials: 'Heavy-body acrylic · India ink · archival linen canvas',
    timeAndTechnique: '28 hours · Hand-painted Dot Mandala',
    availability: 'reserved',
    price: { kind: 'exact', amount: 42000 },
    productId: 'concentric-devotion', // TODO: replace with real catalogue ID
    museum: {
      src: '/Slideshow/02-dot-mandala.jpg',
      alt: 'Concentric Devotion - hand-painted dot mandala on canvas',
    },
  },
  {
    slug: 'mirror-garden',
    title: 'Mirror Garden',
    medium: 'Lippan clay & hand-cut mirror',
    dimensions: '18 × 24 in',
    year: '2025',
    inspiration:
      'A Kutch doorway in monsoon - clay holding light, mirrors holding the rain.',
    materials: 'Mud-clay relief · hand-cut Belgian mirror · gesso primer · bronze leaf',
    timeAndTechnique: '18 hours · Handcrafted Lippan Work',
    availability: 'acquired',
    // No price on acquired pieces - the work is sold; the CTA pivots to commission.
    museum: {
      src: '/Slideshow/03-lippan.jpg',
      alt: 'Mirror Garden - lippan clay relief with hand-cut mirror inlay',
    },
    // DEMO - replace with a real client interior photograph when available.
    room: {
      src: '/Slideshow/03-lippan.jpg',
      alt: 'Mirror Garden installed - placeholder for in-room photography',
      source: 'client',
      location: 'Bengaluru',
    },
  },
  {
    slug: 'white-threshold',
    title: 'White Threshold',
    medium: 'Chalk-ink on dyed cotton',
    dimensions: '16 × 16 in',
    year: '2026',
    inspiration:
      'The kolam under bare feet - drawn before dawn, walked through by noon.',
    materials: 'Hand-mulled chalk-ink · indigo-dyed cotton · cedar mount',
    timeAndTechnique: '12 hours · Single-stroke Kolam Study',
    availability: 'available',
    price: { kind: 'exact', amount: 28000 },
    productId: 'white-threshold', // TODO: replace with real catalogue ID
    museum: {
      src: '/Slideshow/04-kolam.jpg',
      alt: 'White Threshold - single-stroke kolam on indigo-dyed cotton',
    },
  },
  {
    slug: 'threshold-garlands',
    title: 'Threshold Garlands',
    medium: 'Resin, brass & silk thread',
    dimensions: 'Bespoke',
    year: '2026',
    inspiration:
      'Varmalai - the marriage garland - translated into a piece that holds its day forever.',
    materials: 'Pigmented resin · hand-cast brass · naturally-dyed silk',
    timeAndTechnique: '40 hours · Hand-detailed Mirror Embellishment',
    availability: 'commission-only',
    price: { kind: 'starting-from', amount: 85000 },
    museum: {
      src: '/Slideshow/05-wedding-decoratives.jpg',
      alt: 'Threshold Garlands - bespoke wedding piece in resin and brass',
    },
  },
  {
    // PLACEHOLDER imagery - reuses the resin slideshow image. Swap in the
    // actual Salt Witness photograph when available.
    slug: 'salt-witness',
    title: 'Salt Witness',
    medium: 'Resin, sand & gold leaf on panel',
    dimensions: '20 × 26 in',
    year: '2026',
    inspiration:
      'Where the Krishna meets the sea - fresh water remembering salt.',
    materials: 'Pigmented epoxy resin · fine river sand · 24kt gold leaf · birch panel',
    timeAndTechnique: '36 hours · Layered Resin Pour',
    availability: 'available',
    price: { kind: 'exact', amount: 58000 },
    productId: 'salt-witness', // TODO: replace with real catalogue ID
    museum: {
      src: '/Slideshow/01-resin.jpg',
      alt: 'Salt Witness - placeholder using the resin slideshow image',
    },
  },
  {
    // PLACEHOLDER imagery - reuses the dot mandala slideshow image.
    slug: 'sister-rings',
    title: 'Sister Rings',
    medium: 'Mixed media on canvas',
    dimensions: '30 × 30 in',
    year: '2025',
    inspiration:
      'Two mandalas, drawn the day my sister opened her studio in Bengaluru.',
    materials: 'Acrylic · India ink · copper leaf · archival canvas',
    timeAndTechnique: '26 hours · Hand-painted Dot Mandala',
    availability: 'acquired',
    museum: {
      src: '/Slideshow/02-dot-mandala.jpg',
      alt: 'Sister Rings - placeholder using the dot mandala slideshow image',
    },
  },
  {
    // PLACEHOLDER imagery - reuses the lippan slideshow image.
    slug: 'doorway-vii',
    title: 'Doorway VII',
    medium: 'Lippan clay, mirror & gold leaf',
    dimensions: '14 × 20 in',
    year: '2026',
    inspiration:
      'The seventh doorway of the studio - kept blank for a decade, marked finally.',
    materials: 'Lippan clay · hand-cut mirror · 24kt gold leaf · teak frame',
    timeAndTechnique: '22 hours · Handcrafted Lippan Work',
    availability: 'available',
    price: { kind: 'exact', amount: 46000 },
    productId: 'doorway-vii', // TODO: replace with real catalogue ID
    museum: {
      src: '/Slideshow/03-lippan.jpg',
      alt: 'Doorway VII - placeholder using the lippan slideshow image',
    },
  },
] as const

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'] as const

const AVAILABILITY: Record<
  FeaturedWork['availability'],
  { label: string; dotColor: string }
> = {
  available:         { label: 'Available for acquisition',           dotColor: 'rgb(26, 127, 75)' },
  reserved:          { label: 'Reserved (in escrow)',                dotColor: 'rgb(200, 150, 47)' },
  acquired:          { label: 'Privately acquired',                  dotColor: 'rgb(138, 126, 110)' },
  'commission-only': { label: 'Commission only - variations on request', dotColor: 'rgb(138, 106, 26)' },
}

const DEFAULT_REVEAL = 0.6
const REVEAL_RESET_DELAY_MS = 900

// ────────────────────────────────────────────────────────────────────
// Main section
// ────────────────────────────────────────────────────────────────────
export default function FeaturedWorks() {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const reduceMotion = useReducedMotion()

  // Which plate is the dominant viewport occupant - drives chrome counter,
  // progress bar, screen-reader live region, and the per-plate "reset to
  // default reveal" behavior.
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return

    const articles = Array.from(
      scroller.querySelectorAll<HTMLElement>('[data-plate-index]'),
    )

    const io = new IntersectionObserver(
      (entries) => {
        let bestIdx = -1
        let bestRatio = 0
        for (const e of entries) {
          if (e.intersectionRatio > bestRatio) {
            bestRatio = e.intersectionRatio
            const idx = Number((e.target as HTMLElement).dataset.plateIndex)
            if (!Number.isNaN(idx)) bestIdx = idx
          }
        }
        if (bestRatio > 0.55 && bestIdx >= 0) setActive(bestIdx)
      },
      { root: scroller, threshold: [0.3, 0.55, 0.75, 1] },
    )
    articles.forEach((a) => io.observe(a))
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const goTo = useCallback((i: number) => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const target = scroller.querySelector<HTMLElement>(
      `[data-plate-index="${i}"]`,
    )
    if (!target) return
    scroller.scrollTo({ top: target.offsetTop, behavior: 'smooth' })
  }, [])

  return (
    <section
      aria-label="Featured Works - selected pieces"
      className="relative w-full bg-plum overflow-hidden focus:outline-none"
      style={{ height: '100svh', minHeight: 640 }}
    >
      {/* Skip link - lets keyboard users bypass the wing */}
      <a
        href="#after-featured-works"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-1/2
                   focus:-translate-x-1/2 focus:z-[10] focus:px-3 focus:py-1.5 focus:bg-ink
                   focus:text-plum focus:text-xs focus:rounded-sm"
      >
        Skip Featured Works
      </a>

      {/* Top-left: room title */}
      <div className="absolute top-8 lg:top-10 left-5 sm:left-10 lg:left-16 z-[5] pointer-events-none">
        <div className="flex items-center gap-4">
          <span aria-hidden className="h-px w-10 bg-ink/50" />
          <span
            className="text-[11px] font-semibold uppercase text-ink/70"
            style={{ letterSpacing: '0.32em' }}
          >
            Room 05 - Featured Works
          </span>
        </div>
      </div>

      {/* Top-right: plate counter (roman) */}
      <div className="absolute top-8 lg:top-10 right-5 sm:right-10 lg:right-16 z-[5] flex items-center gap-3 pointer-events-none">
        <motion.span
          key={`fw-ctr-${active}`}
          initial={reduceMotion ? false : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="font-serif text-2xl text-ink"
          style={{ minWidth: 32, textAlign: 'right' }}
        >
          {ROMAN[active]}
        </motion.span>
        <span aria-hidden className="h-px w-6 bg-ink/40" />
        <span className="font-serif text-sm text-ink/55">VIII</span>
      </div>

      {/* The contained vertical scroller */}
      <div
        ref={scrollerRef}
        className="absolute inset-0 overflow-y-auto overflow-x-hidden scrollbar-hide
                   snap-y snap-mandatory scroll-smooth"
        style={{
          scrollSnapType: reduceMotion ? 'y proximity' : 'y mandatory',
          overscrollBehaviorY: 'auto',
        }}
      >
        {WORKS.map((work, i) => (
          <FeaturedPlate
            key={work.slug}
            work={work}
            index={i}
            isActive={i === active}
            scrollerRef={scrollerRef}
            reduceMotion={!!reduceMotion}
          />
        ))}
      </div>

      {/* Bottom tick progress - one tick per plate */}
      <div className="absolute inset-x-0 bottom-6 lg:bottom-8 z-[5] flex items-center justify-center gap-2 pointer-events-none">
        {WORKS.map((w, i) => {
          const isActive = i === active
          return (
            <button
              key={w.slug}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Show plate ${ROMAN[i]} - ${w.title}`}
              aria-current={isActive ? 'true' : undefined}
              className="group p-2 -m-2 pointer-events-auto"
            >
              <span
                aria-hidden
                className={`block h-[2px] transition-all duration-500 ${
                  isActive
                    ? 'w-12 bg-ink'
                    : 'w-6 bg-ink/25 group-hover:w-8 group-hover:bg-ink/55'
                }`}
              />
            </button>
          )
        })}
      </div>

      {/* SR live region announces plate changes */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        Now viewing Plate {ROMAN[active]} - {WORKS[active]!.title}
      </p>

      {/* Anchor for the skip link */}
      <span id="after-featured-works" className="sr-only" aria-hidden />
    </section>
  )
}

// ────────────────────────────────────────────────────────────────────
// One plate - plate + editorial column. Renders RevealPlate or
// PlinthPlate based on whether room photography is available.
// ────────────────────────────────────────────────────────────────────
function FeaturedPlate({
  work,
  index,
  isActive,
  scrollerRef,
  reduceMotion,
}: {
  work: FeaturedWork
  index: number
  isActive: boolean
  scrollerRef: React.RefObject<HTMLDivElement | null>
  reduceMotion: boolean
}) {
  const hasReveal = !!work.room
  const loadStrategy: 'eager' | 'lazy' = index < 3 ? 'eager' : 'lazy'

  return (
    <article
      data-plate-index={index}
      aria-labelledby={`plate-${work.slug}-title`}
      className="relative w-full h-[100svh] snap-start flex items-center"
      style={{ scrollSnapStop: 'always' }}
    >
      <div className="w-full max-w-[1640px] mx-auto px-5 sm:px-10 lg:px-16 pt-24 pb-24 lg:pt-32 lg:pb-28">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14">
          {/* Plate column */}
          <div className="lg:col-span-7 relative flex items-center justify-center order-1">
            {hasReveal ? (
              <RevealPlate
                work={work}
                isActive={isActive}
                loadStrategy={loadStrategy}
                priority={index === 0}
                reduceMotion={reduceMotion}
              />
            ) : (
              <PlinthPlate
                work={work}
                loadStrategy={loadStrategy}
                priority={index === 0}
              />
            )}
          </div>

          {/* Editorial column */}
          <div className="lg:col-span-5 flex flex-col justify-center order-2">
            <EditorialColumn
              work={work}
              index={index}
              scrollerRef={scrollerRef}
              reduceMotion={reduceMotion}
            />
          </div>
        </div>
      </div>
    </article>
  )
}

// ────────────────────────────────────────────────────────────────────
// PlinthPlate - pure museum mount. No drag, no divider.
// ────────────────────────────────────────────────────────────────────
function PlinthPlate({
  work,
  loadStrategy,
  priority,
}: {
  work: FeaturedWork
  loadStrategy: 'eager' | 'lazy'
  priority: boolean
}) {
  return (
    <div className="w-full max-w-[640px]">
      <div className="resin-plate relative aspect-[4/5]">
        <PictureImage
          src={work.museum.src}
          alt={work.museum.alt}
          fill
          sizes="(min-width: 1024px) 55vw, 100vw"
          priority={priority}
          loading={loadStrategy}
          className="object-cover"
        />
        {/* Static centred specular - adds dimension without competing
            with any interaction (none here). */}
        <div className="resin-specular" />
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// RevealPlate - museum base + clipped in-room overlay + drag divider.
// ────────────────────────────────────────────────────────────────────
function RevealPlate({
  work,
  isActive,
  loadStrategy,
  priority,
  reduceMotion,
}: {
  work: FeaturedWork
  isActive: boolean
  loadStrategy: 'eager' | 'lazy'
  priority: boolean
  reduceMotion: boolean
}) {
  const plateRef = useRef<HTMLDivElement>(null)
  const [reveal, setReveal] = useState(DEFAULT_REVEAL)
  const userHasDragged = useRef(false)

  // Resolve source caption from room metadata.
  const room = work.room!
  const locTag = room.location ? `, ${room.location}` : ''
  const inSituText =
    room.source === 'client'
      ? `In situ - client residence${locTag}`
      : `Staged interior${room.location ? ` - ${room.location}` : ' - studio'}`

  const sourceTag =
    reveal <= 0.05
      ? inSituText
      : reveal >= 0.95
        ? 'Mounted at the studio.'
        : 'Drag the divider to view in your space.'

  // Apply reveal to the DOM (custom property) - single source of truth.
  // We also keep the React state for ARIA `aria-valuenow` reporting and
  // the source caption updates.
  const applyReveal = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v))
    const plate = plateRef.current
    if (plate) plate.style.setProperty('--reveal', clamped.toFixed(4))
    setReveal(clamped)
  }, [])

  // On scroll-snap away, gently reset to default - but only if the user
  // had actually dragged. If they never touched it, the default is already
  // in place and we skip the work.
  useEffect(() => {
    if (isActive) return
    if (!userHasDragged.current) return
    const id = setTimeout(() => {
      applyReveal(DEFAULT_REVEAL)
      userHasDragged.current = false
    }, REVEAL_RESET_DELAY_MS)
    return () => clearTimeout(id)
  }, [isActive, applyReveal])

  // First-render - set the CSS variable so the in-room layer's clip-path
  // resolves on the very first paint (avoids a flash at reveal=0).
  useEffect(() => {
    applyReveal(DEFAULT_REVEAL)
  }, [applyReveal])

  // Pointer drag - captured on the divider button. Updates `--reveal`
  // imperatively (no React re-render per move) for smoothness; state
  // syncs at pointerup for ARIA correctness.
  const onDividerPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault()
    const plate = plateRef.current
    if (!plate) return

    userHasDragged.current = true
    const targetEl = e.currentTarget
    targetEl.setPointerCapture(e.pointerId)

    const computeReveal = (clientX: number) => {
      const rect = plate.getBoundingClientRect()
      return (clientX - rect.left) / rect.width
    }

    // Apply immediately so a tap (no move) snaps the divider under the cursor.
    const initial = computeReveal(e.clientX)
    applyReveal(initial)

    const onMove = (ev: PointerEvent) => {
      // Imperative DOM update for smoothness - no React re-render here.
      const clamped = Math.max(0, Math.min(1, computeReveal(ev.clientX)))
      if (plate) plate.style.setProperty('--reveal', clamped.toFixed(4))
    }
    const onUp = (ev: PointerEvent) => {
      const clamped = Math.max(0, Math.min(1, computeReveal(ev.clientX)))
      applyReveal(clamped) // syncs React state for ARIA + caption
      targetEl.removeEventListener('pointermove', onMove)
      targetEl.removeEventListener('pointerup', onUp)
      targetEl.removeEventListener('pointercancel', onUp)
      try {
        targetEl.releasePointerCapture(ev.pointerId)
      } catch {
        // ignore - capture may already be released
      }
    }
    targetEl.addEventListener('pointermove', onMove)
    targetEl.addEventListener('pointerup', onUp)
    targetEl.addEventListener('pointercancel', onUp)
  }

  // Keyboard - Arrow keys adjust by 10%, Home/End jump to extremes.
  const onDividerKey = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    let next: number | null = null
    if (e.key === 'ArrowLeft')  next = reveal - 0.1
    else if (e.key === 'ArrowRight') next = reveal + 0.1
    else if (e.key === 'Home')   next = 0
    else if (e.key === 'End')    next = 1
    if (next == null) return
    e.preventDefault()
    userHasDragged.current = true
    applyReveal(next)
  }

  const revealPct = Math.round(reveal * 100)

  return (
    <div className="w-full max-w-[640px]">
      <div
        ref={plateRef}
        className="resin-plate relative aspect-[4/5] select-none"
        style={
          {
            ['--reveal' as never]: String(DEFAULT_REVEAL),
            touchAction: 'pan-y',
          } as React.CSSProperties
        }
      >
        {/* Layer 1 - museum (base). Always full-bleed. */}
        <PictureImage
          src={work.museum.src}
          alt={work.museum.alt}
          fill
          sizes="(min-width: 1024px) 55vw, 100vw"
          priority={priority}
          loading={loadStrategy}
          className="object-cover"
        />

        {/* Layer 2 - in-room. Clipped to the area right of the divider. */}
        <div
          aria-hidden
          className="absolute inset-0 z-[2]"
          style={{
            clipPath:
              'inset(0 0 0 calc(var(--reveal, 0.6) * 100%))',
          }}
        >
          <PictureImage
            src={room.src}
            alt={room.alt}
            fill
            sizes="(min-width: 1024px) 55vw, 100vw"
            priority={priority}
            loading={loadStrategy}
            className="object-cover"
          />
        </div>

        {/* Centred specular - sits above both layers, soft-light blend. */}
        <div className="resin-specular" />

        {/* The divider - a real <button role="slider"> with full keyboard
            support. Sits at the reveal boundary, full plate height. */}
        <button
          type="button"
          role="slider"
          aria-label={`Reveal "${work.title}" in your living space versus on the museum mount`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={revealPct}
          aria-valuetext={
            reveal <= 0.05
              ? 'Fully shown in your living space'
              : reveal >= 0.95
                ? 'Fully on museum mount'
                : `${revealPct}% museum mount, ${100 - revealPct}% in your space`
          }
          onPointerDown={onDividerPointerDown}
          onKeyDown={onDividerKey}
          className="absolute top-0 bottom-0 z-[7] flex items-center justify-center
                     cursor-col-resize
                     focus-visible:outline-none"
          style={{
            left: 'calc(var(--reveal, 0.6) * 100%)',
            transform: 'translateX(-50%)',
            width: 44,
            touchAction: 'none',
          }}
        >
          {/* Vertical gold rule */}
          <span
            aria-hidden
            className="absolute top-0 bottom-0 w-px pointer-events-none"
            style={{
              background:
                'linear-gradient(180deg, rgba(232,194,90,0) 0%, rgba(232,194,90,0.9) 14%, rgba(232,194,90,1) 50%, rgba(232,194,90,0.9) 86%, rgba(232,194,90,0) 100%)',
              boxShadow: '0 0 12px rgba(232,194,90,0.55)',
            }}
          />
          {/* Drag wings - small dark pill with two gold chevrons */}
          <span
            aria-hidden
            className="relative inline-flex items-center gap-0.5 px-2.5 py-2 rounded-full
                       text-[color:var(--gold-leaf)] transition-all duration-300
                       group-hover:scale-105"
            style={{
              background: 'rgba(34, 27, 18, 0.88)',
              boxShadow:
                '0 6px 14px -6px rgba(34,27,18,0.5), 0 0 0 1px rgba(232,194,90,0.35)',
            }}
          >
            <ChevronLeft className="w-3 h-3" />
            <ChevronRight className="w-3 h-3" />
          </span>
        </button>
      </div>

      {/* Source caption - updates at extreme reveal positions. Lives in a
          polite live region so screen-reader users hear the context shift. */}
      <p
        className="mt-3 text-[10px] font-semibold uppercase text-ink/55 text-center"
        style={{ letterSpacing: '0.28em' }}
        aria-live="polite"
        aria-atomic="true"
      >
        {sourceTag}
      </p>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// EditorialColumn - the museum-card caption beside each plate.
// ────────────────────────────────────────────────────────────────────
function EditorialColumn({
  work,
  index,
  scrollerRef,
  reduceMotion,
}: {
  work: FeaturedWork
  index: number
  scrollerRef: React.RefObject<HTMLDivElement | null>
  reduceMotion: boolean
}) {
  const avail = AVAILABILITY[work.availability]

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{
        root: scrollerRef as React.RefObject<Element>,
        amount: 0.5,
        once: false,
      }}
      transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
      className="max-w-xl"
    >
      {/* Plate number */}
      <p
        className="text-[10px] font-semibold uppercase text-ink/55 mb-4"
        style={{ letterSpacing: '0.36em' }}
      >
        Plate {ROMAN[index]}
      </p>

      {/* Title */}
      <h3
        id={`plate-${work.slug}-title`}
        className="font-serif font-medium text-ink leading-[1.04] tracking-[-0.005em]"
        style={{ fontSize: 'clamp(30px, 3.6vw, 60px)' }}
      >
        {work.title}
      </h3>

      {/* Medium · dimensions · year */}
      <p
        className="mt-4 text-[11px] uppercase text-ink/65"
        style={{ letterSpacing: '0.14em' }}
      >
        {work.medium}
        <span aria-hidden className="text-ink/30 px-2">·</span>
        {work.dimensions}
        <span aria-hidden className="text-ink/30 px-2">·</span>
        {work.year}
      </p>

      {/* Availability badge + price - paired tightly to make the buying
          frame obvious without going salesy. Editorial register. */}
      <div className="mt-5 flex flex-wrap items-baseline gap-x-5 gap-y-1.5">
        <AvailabilityBadge availability={work.availability} />
        {work.price && (
          <p
            className="font-serif text-ink"
            style={{
              fontSize: 'clamp(20px, 1.8vw, 28px)',
              letterSpacing: '-0.005em',
            }}
          >
            {work.price.kind === 'starting-from' && (
              <span
                className="text-[10px] font-sans font-semibold uppercase text-ink/55 mr-2 align-baseline"
                style={{ letterSpacing: '0.28em' }}
              >
                From
              </span>
            )}
            {formatINR(work.price.amount)}
          </p>
        )}
      </div>

      {/* Inspiration */}
      <p
        className="mt-6 font-serif text-ink/85"
        style={{
          fontSize: 'clamp(15px, 1.1vw, 19px)',
          lineHeight: 1.55,
        }}
      >
        “{work.inspiration}”
      </p>

      {/* Materials + Time & Technique - tabular eyebrow + content rows */}
      <dl className="mt-6 grid grid-cols-[max-content_1fr] gap-x-5 gap-y-3 text-sm">
        <dt
          className="text-[10px] font-semibold uppercase text-ink/55 pt-0.5"
          style={{ letterSpacing: '0.28em' }}
        >
          Materials
        </dt>
        <dd className="text-ink/80">{work.materials}</dd>

        <dt
          className="text-[10px] font-semibold uppercase text-ink/55 pt-0.5"
          style={{ letterSpacing: '0.28em' }}
        >
          Time & Technique
        </dt>
        <dd className="text-ink/80">{work.timeAndTechnique}</dd>
      </dl>

      {/* Action panel - branches by availability state. Wires real cart
          actions for in-stock pieces; pivots to commission for sold ones. */}
      <div className="mt-8">
        <ActionPanel work={work} />
      </div>
    </motion.div>
  )
}

// ────────────────────────────────────────────────────────────────────
// AvailabilityBadge - letterpress-style status tag.
// ────────────────────────────────────────────────────────────────────
function AvailabilityBadge({
  availability,
}: {
  availability: FeaturedWork['availability']
}) {
  const { label, dotColor } = AVAILABILITY[availability]
  return (
    <span
      className="inline-flex items-center gap-2.5 text-[10px] uppercase font-semibold text-ink/80"
      style={{ letterSpacing: '0.32em' }}
    >
      <span
        aria-hidden
        className="block w-1.5 h-1.5 rounded-full"
        style={{ background: dotColor, boxShadow: `0 0 8px ${dotColor}55` }}
      />
      {label}
    </span>
  )
}

// ────────────────────────────────────────────────────────────────────
// ActionPanel - the commerce layer of Room 05.
//
// The wing is a desire-generation experience, but the user's primary
// business objective is selling work. Every plate therefore exposes
// concrete buying paths based on its availability state. The panel
// branches:
//
//   available           Buy Now (resin)  +  Add to Cart (outline)
//                       View Details  ·  Inquire on WhatsApp
//
//   reserved            View Details (outline, primary)
//                       Inquire on WhatsApp
//
//   commission-only     Begin a Commission (resin)
//                       Inquire on WhatsApp
//
//   acquired            Commission a Similar Piece (resin)
//                       (no inquiry - the piece is sold; commission is
//                        the only meaningful path forward)
//
// For cart actions we fetch the full Product object on click via the
// existing apiFetch, then dispatch through the existing useAddToCart
// hook - which already handles auth gating, pending intents, login
// redirect, and the cart drawer. If the fetch fails (network, 404,
// productId not yet mapped), we gracefully fall back to navigation
// toward the product page so the visitor is never stranded.
// ────────────────────────────────────────────────────────────────────
function ActionPanel({ work }: { work: FeaturedWork }) {
  switch (work.availability) {
    case 'acquired':
      return <AcquiredActions work={work} />
    case 'commission-only':
      return <CommissionActions work={work} />
    case 'reserved':
      return <ReservedActions work={work} />
    case 'available':
    default:
      return <AvailableActions work={work} />
  }
}

// ── Available - full commerce stack ──────────────────────────────
function AvailableActions({ work }: { work: FeaturedWork }) {
  const router = useRouter()
  const { addToCart } = useAddToCart()
  const [busy, setBusy] = useState<null | 'buy' | 'cart'>(null)

  const hasProduct = !!work.productId

  const handle = async (action: 'buy' | 'cart') => {
    if (!hasProduct) {
      // No catalogue product yet - best we can do is route the visitor
      // toward Shop. Should be rare in production once productIds are mapped.
      router.push('/shop')
      return
    }
    setBusy(action)
    try {
      const res = await apiFetch<{ product: Product }>(
        `/products/${encodeURIComponent(String(work.productId))}`,
      )
      const product = res.product
      const added = addToCart(product, 1, { openDrawer: action === 'cart' })
      if (!added) {
        // useAddToCart sent the visitor to login. Their intent is queued
        // and will replay automatically on successful login.
        return
      }
      trackEvent({
        name: action === 'buy' ? 'begin_checkout' : 'add_to_cart',
        params: {
          item_id: String(work.productId),
          item_name: work.title,
          price: work.price?.amount,
          source: 'featured_works',
        },
      })
      if (action === 'buy') {
        router.push('/checkout')
      }
    } catch {
      // Fetch failed - fall back to the product page so the visitor can
      // still complete the action manually.
      router.push(`/product/${encodeURIComponent(String(work.productId))}`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={() => handle('buy')}
          disabled={busy !== null}
          aria-label={`Buy "${work.title}" now`}
          data-track="featured_buy_now"
          data-piece={work.slug}
          className="btn-resin"
        >
          {busy === 'buy' ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
          ) : (
            <ShoppingBag className="w-4 h-4" aria-hidden />
          )}
          {busy === 'buy' ? 'Adding…' : 'Buy Now'}
        </button>
        <button
          type="button"
          onClick={() => handle('cart')}
          disabled={busy !== null}
          aria-label={`Add "${work.title}" to cart`}
          data-track="featured_add_to_cart"
          data-piece={work.slug}
          className="btn-outline"
        >
          {busy === 'cart' ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
          ) : null}
          {busy === 'cart' ? 'Adding…' : 'Add to Cart'}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <ViewDetailsLink work={work} />
        <WhatsAppInquiryLink work={work} />
      </div>
    </div>
  )
}

// ── Reserved - no cart, but Details is still discoverable ─────────
function ReservedActions({ work }: { work: FeaturedWork }) {
  return (
    <div className="flex flex-col gap-5">
      {work.productId && (
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href={`/product/${encodeURIComponent(String(work.productId))}`}
            data-track="featured_view_details"
            data-piece={work.slug}
            onClick={() =>
              trackEvent({
                name: 'select_item',
                params: {
                  item_id: String(work.productId),
                  item_name: work.title,
                  source: 'featured_works',
                },
              })
            }
            className="btn-outline"
          >
            View Details
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <WhatsAppInquiryLink work={work} />
      </div>
    </div>
  )
}

// ── Commission-only - push to /custom-order, keep WhatsApp as soft path ─
function CommissionActions({ work }: { work: FeaturedWork }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href={`/custom-order?inspiration=${encodeURIComponent(work.slug)}`}
          data-track="featured_commission"
          data-piece={work.slug}
          onClick={() =>
            trackEvent({
              name: 'commission_inquiry',
              params: {
                item_id: work.productId ? String(work.productId) : undefined,
                item_name: work.title,
                source: 'featured_works',
              },
            })
          }
          className="btn-resin"
        >
          <Sparkles className="w-4 h-4" aria-hidden />
          Begin a Commission
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <WhatsAppInquiryLink work={work} kind="commission" />
      </div>
    </div>
  )
}

// ── Acquired - pure pivot to commission. No inquiry, no purchase. ───
function AcquiredActions({ work }: { work: FeaturedWork }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href={`/custom-order?inspiration=${encodeURIComponent(work.slug)}`}
          data-track="featured_commission_similar"
          data-piece={work.slug}
          onClick={() =>
            trackEvent({
              name: 'commission_inquiry',
              params: {
                item_id: work.productId ? String(work.productId) : undefined,
                item_name: work.title,
                source: 'featured_works',
              },
            })
          }
          className="btn-resin"
        >
          <Sparkles className="w-4 h-4" aria-hidden />
          Commission a Similar Piece
        </Link>
      </div>
    </div>
  )
}

// ── Reusable: View Details text link ─────────────────────────────
function ViewDetailsLink({ work }: { work: FeaturedWork }) {
  if (!work.productId) return null
  return (
    <Link
      href={`/product/${encodeURIComponent(String(work.productId))}`}
      data-track="featured_view_details"
      data-piece={work.slug}
      onClick={() =>
        trackEvent({
          name: 'select_item',
          params: {
            item_id: String(work.productId),
            item_name: work.title,
            source: 'featured_works',
          },
        })
      }
      className="group inline-flex items-center gap-2.5 text-sm font-semibold uppercase
                 text-ink/80 hover:text-ink transition-all duration-500
                 focus-visible:outline-none focus-visible:ring-2
                 focus-visible:ring-[color:var(--accent-strong)]
                 focus-visible:ring-offset-2 focus-visible:ring-offset-plum rounded-sm"
      style={{ letterSpacing: '0.14em' }}
    >
      <span className="relative">
        View Details
        <span
          aria-hidden
          className="absolute -bottom-1 left-0 h-px w-full bg-ink/30
                     scale-x-0 origin-left transition-transform duration-500
                     group-hover:scale-x-100 group-focus-visible:scale-x-100"
        />
      </span>
      <ArrowUpRight className="w-3.5 h-3.5 shrink-0" aria-hidden />
    </Link>
  )
}

// ── Reusable: WhatsApp inquiry text link ─────────────────────────
function WhatsAppInquiryLink({
  work,
  kind = 'inquiry',
}: {
  work: FeaturedWork
  kind?: 'inquiry' | 'commission'
}) {
  const baseMessage =
    work.inquiryPrefill ??
    (kind === 'commission'
      ? `Hi Srilatha, I'd like to discuss commissioning a piece inspired by "${work.title}".`
      : `Hi Srilatha, I'd like to discuss "${work.title}" - I've been picturing it on a wall at home.`)
  const href = waLink(baseMessage)
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Inquire about "${work.title}" on WhatsApp`}
      data-track="featured_whatsapp"
      data-piece={work.slug}
      onClick={() =>
        trackEvent({
          name: 'whatsapp_inquiry',
          params: {
            item_id: work.productId ? String(work.productId) : undefined,
            item_name: work.title,
            source: 'featured_works',
          },
        })
      }
      className="group inline-flex items-center gap-2.5 text-sm font-semibold uppercase
                 text-[color:var(--accent-strong)] hover:text-[color:var(--gold-deep)]
                 transition-colors duration-500
                 focus-visible:outline-none focus-visible:ring-2
                 focus-visible:ring-[color:var(--accent-strong)]
                 focus-visible:ring-offset-2 focus-visible:ring-offset-plum rounded-sm"
      style={{ letterSpacing: '0.14em' }}
    >
      <MessageCircle className="w-4 h-4 shrink-0" aria-hidden />
      <span>Inquire on WhatsApp</span>
    </a>
  )
}
