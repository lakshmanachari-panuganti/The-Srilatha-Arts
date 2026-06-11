'use client'

/**
 * /reviews — public list of approved, verified-buyer reviews.
 *
 * Pulls from /api/reviews/recent (sitewide approved reviews, ordered by
 * createdAt desc). Empty-state is honest: when there are no real approved
 * reviews yet, the page says so and invites the visitor to be the first
 * via /contact. No fake testimonials. No placeholders pretending to be
 * customers.
 */

import Link from 'next/link'
import { Star } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

interface ReviewApi {
  id: string
  productId: string
  userName: string
  rating: number
  title?: string
  body: string
  photos?: string[]
  adminReply?: string
  createdAt: string
}

interface RecentReviewsResponse {
  reviews: ReviewApi[]
  total: number
}

export default function ReviewsClient() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['reviews', 'recent', 50],
    queryFn: () => apiFetch<RecentReviewsResponse>('/reviews/recent?limit=50'),
    staleTime: 60_000,
  })

  const reviews = data?.reviews ?? []

  return (
    <main className="max-w-3xl mx-auto px-5 py-16 lg:py-24">
      <p className="eyebrow mb-3">Customer reviews</p>
      <h1 className="display text-4xl md:text-5xl lg:text-6xl mb-5">
        Real reviews from real <em className="italic gold-text">buyers</em>
      </h1>
      <p className="text-ivory-soft text-base lg:text-lg leading-relaxed mb-10">
        Every review here is from a customer who actually received their piece.
        We verify purchase before a review can be submitted, and we moderate
        before publishing.
      </p>

      {isLoading && (
        <ul className="space-y-5" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="card p-6 lg:p-7 animate-pulse">
              <div className="h-4 w-32 bg-ink/10 rounded mb-3" />
              <div className="h-4 w-full bg-ink/10 rounded mb-2" />
              <div className="h-4 w-5/6 bg-ink/10 rounded mb-4" />
              <div className="h-3 w-1/3 bg-ink/10 rounded" />
            </li>
          ))}
        </ul>
      )}

      {!isLoading && isError && (
        <div className="card p-6 text-center">
          <p className="text-ivory-soft">
            Couldn&apos;t load reviews right now. Please try again in a moment.
          </p>
        </div>
      )}

      {!isLoading && !isError && reviews.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-ivory text-lg mb-3">
            We&apos;re just opening the studio&apos;s public-review wall.
          </p>
          <p className="text-ivory-soft mb-6">
            When customers receive their pieces and share their experience,
            you&apos;ll see their reviews here.
          </p>
          <Link href="/shop" className="btn-outline">
            Browse the pieces
          </Link>
        </div>
      )}

      {!isLoading && !isError && reviews.length > 0 && (
        <ul className="space-y-5">
          {reviews.map((r) => (
            <li key={r.id} className="card p-6 lg:p-7">
              <div
                className="flex items-center gap-1 mb-3"
                aria-label={`Rated ${r.rating} out of 5`}
              >
                {Array.from({ length: r.rating }).map((_, i) => (
                  <Star
                    key={i}
                    className="w-4 h-4 fill-lavender-pastel text-lavender-pastel"
                    aria-hidden
                  />
                ))}
              </div>
              {r.title && (
                <p className="text-ivory font-semibold text-base lg:text-lg mb-2">
                  {r.title}
                </p>
              )}
              <p className="text-ivory text-base lg:text-lg leading-relaxed mb-4">
                &ldquo;{r.body}&rdquo;
              </p>
              {r.photos && r.photos.length > 0 && (
                <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
                  {r.photos.slice(0, 4).map((src, i) => (
                    // Reviewer photos sit on the user's blob; PictureImage
                    // demands optimisation pre-build, so plain <img> is the
                    // right call here.
                    <img
                      key={`${r.id}-p${i}`}
                      src={src}
                      alt={`Photo ${i + 1} from ${r.userName}`}
                      className="h-20 w-20 object-cover rounded-md shrink-0 border border-white/10"
                      loading="lazy"
                    />
                  ))}
                </div>
              )}
              {r.adminReply && (
                <div className="border-l-2 border-[color:var(--accent-strong)] pl-4 my-4 text-sm text-ivory-soft italic">
                  <p className="mb-1 text-xs uppercase text-[color:var(--accent-strong)]"
                     style={{ letterSpacing: '0.18em' }}>
                    Studio reply
                  </p>
                  {r.adminReply}
                </div>
              )}
              <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-3 flex-wrap">
                <p className="text-sm text-ivory">
                  <span className="font-medium">{anonymize(r.userName)}</span>
                  <span className="text-ivory-mute"> · verified buyer</span>
                </p>
                <p className="text-xs text-ivory-mute">
                  {formatDate(r.createdAt)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="text-center mt-12">
        <p className="text-ivory-soft mb-4">
          Bought a piece and want to share your experience?
        </p>
        <Link href="/account/orders" className="btn-outline">
          Review your order
        </Link>
      </div>
    </main>
  )
}

// Honour the project's "first name + city only" identity rule. We don't have
// city for reviews stored in this surface; we render the supplied display
// name as-is provided it isn't an obviously-email string. If the admin moves
// to the new schema (firstName / city), update this in one place.
function anonymize(userName: string): string {
  if (!userName) return 'Verified buyer'
  // If it looks like an email address, take the part before '@'.
  if (userName.includes('@')) return userName.split('@')[0] || 'Verified buyer'
  return userName
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return ''
  }
}
