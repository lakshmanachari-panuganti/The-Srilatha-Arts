'use client'

/**
 * Homepage Testimonials section.
 *
 * Pulls approved reviews from /api/reviews/recent (replaces the prior
 * hard-coded mock list). Renders nothing when:
 *   - the query is still loading (avoids a flash of placeholder content)
 *   - the studio has no approved reviews yet (no mock testimonials!)
 *   - the query errored (silent fail - better than a broken-looking section)
 *
 * The discipline: a luxury studio site can show fewer real reviews and
 * still convert; it cannot show fabricated ones without forfeiting trust.
 */

import { Quote, Star, ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { stagger, fadeUp } from '@/lib/motion'
import { apiFetch } from '@/lib/api'

interface ReviewApi {
  id: string
  productId: string
  userName: string
  rating: number
  title?: string
  body: string
  createdAt: string
}

interface RecentReviewsResponse {
  reviews: ReviewApi[]
  total: number
}

// How many testimonials to render on the homepage. Conservative - we'd
// rather show three powerful ones than nine weak ones.
const HOMEPAGE_LIMIT = 6

export default function Testimonials() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['reviews', 'recent', HOMEPAGE_LIMIT],
    queryFn: () =>
      apiFetch<RecentReviewsResponse>(`/reviews/recent?limit=${HOMEPAGE_LIMIT}`),
    staleTime: 5 * 60_000,
  })

  // Silent skip when there's nothing real to show. The homepage doesn't
  // need a placeholder section - the rest of the page carries the load.
  if (isLoading || isError) return null
  const reviews = data?.reviews ?? []
  if (reviews.length === 0) return null

  return (
    <motion.section
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="relative px-5 lg:px-8 py-14 sm:py-20 lg:py-32 max-w-6xl mx-auto"
    >
      <div className="relative z-10">
        <div className="mb-8 sm:mb-12 lg:mb-16 max-w-2xl">
          <p className="eyebrow mb-4">Real customer reviews</p>
          <h2 className="display text-4xl lg:text-6xl">
            What our <em className="italic">buyers</em> say.
          </h2>
        </div>

        {/* Mobile carousel with swipe hint */}
        <div className="lg:hidden">
          <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-5 px-5 scrollbar-hide">
            {reviews.map((r) => (
              <ReviewCard key={r.id} review={r} />
            ))}
            <div className="shrink-0 w-2" aria-hidden />
          </div>
          {reviews.length > 1 && (
            <p
              className="mt-3 flex items-center justify-end gap-1 text-[11px] uppercase tracking-widest text-ivory-mute"
              aria-hidden
            >
              Swipe to see more
              <ChevronRight className="w-3 h-3" />
            </p>
          )}
        </div>

        {/* Desktop staggered grid */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-20px' }}
          variants={stagger}
          className="hidden lg:grid grid-cols-3 gap-7"
        >
          {reviews.map((r) => (
            <motion.div key={r.id} variants={fadeUp}>
              <ReviewCard review={r} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.section>
  )
}

function ReviewCard({ review }: { review: ReviewApi }) {
  const name = displayName(review.userName)
  const initial = name.charAt(0).toUpperCase()

  return (
    <article className="card w-[80vw] sm:w-96 lg:w-auto shrink-0 snap-start p-7 lg:p-8 flex flex-col">
      <div
        className="flex items-center gap-1 mb-4"
        aria-label={`Rated ${review.rating} out of 5`}
      >
        {Array.from({ length: review.rating }).map((_, i) => (
          <Star
            key={i}
            className="w-4 h-4 fill-lavender-pastel text-lavender-pastel"
            aria-hidden
          />
        ))}
      </div>
      <Quote className="w-6 h-6 text-lavender-pastel/70 mb-3" aria-hidden />
      <p className="font-serif text-lg lg:text-xl text-ivory leading-relaxed mb-6 flex-1">
        &ldquo;{review.body}&rdquo;
      </p>
      <div className="pt-4 border-t border-lavender-soft/25 flex items-center gap-3">
        <span
          className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center
                     text-sm font-bold text-white"
          style={{
            background:
              'linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)',
          }}
          aria-hidden
        >
          {initial}
        </span>
        <div>
          <p className="text-sm text-ivory font-semibold tracking-wide">{name}</p>
          <p className="text-xs text-ivory-mute mt-0.5">Verified buyer</p>
        </div>
      </div>
    </article>
  )
}

// First-name-only display per the identity rule. If the API hands us an
// email-shaped value (legacy seed reviews), extract the local-part. Add
// city later when the review schema is extended (per the post-purchase
// pipeline backlog).
function displayName(raw: string): string {
  if (!raw) return 'Verified buyer'
  if (raw.includes('@')) {
    const local = raw.split('@')[0] || ''
    return local.charAt(0).toUpperCase() + local.slice(1)
  }
  // First word only - "Priya Sharma" → "Priya"
  return raw.split(/\s+/)[0] ?? raw
}
