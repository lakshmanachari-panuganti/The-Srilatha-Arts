'use client'

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import Image from 'next/image'
import { Star, Hand, Sparkles, Truck, ChevronLeft, MessageSquare, ShieldCheck, Gift, Pencil } from 'lucide-react'
import { FreeShippingThreshold } from '@/components/ShippingFigures'
import { CATEGORY_BY_SLUG } from '@/data/categories'
import { formatINR, discountPct } from '@/lib/format'
import { apiFetch } from '@/lib/api'
import { useUserAuth } from '@/stores/userAuth'
import StickyCartBar from '@/components/shop/StickyCartBar'
import ProductCard from '@/components/shop/ProductCard'
import PhotoUploader from '@/components/PhotoUploader'
import type { Product } from '@/types'

function ProductSkeleton() {
  return (
    <div className="max-w-6xl mx-auto lg:grid lg:grid-cols-2 lg:gap-14 lg:px-8 lg:pt-10 animate-pulse">
      <div className="lg:rounded-[32px] overflow-hidden bg-cream-deep aspect-[4/5]" />
      <div className="px-5 lg:px-0 pt-8 space-y-4">
        <div className="h-4 w-24 bg-ink/10 rounded" />
        <div className="h-10 w-3/4 bg-ink/10 rounded" />
        <div className="h-8 w-1/3 bg-ink/10 rounded" />
        <div className="h-32 bg-ink/10 rounded" />
      </div>
    </div>
  )
}

function Pill({ label }: { label: string }) {
  return (
    <span className="inline-flex h-9 px-4 items-center rounded-full border border-ink/12 bg-paper text-xs text-ink-soft">
      {label}
    </span>
  )
}

function Feature({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-sm text-ink/85">
      <span className="w-9 h-9 rounded-full bg-paper text-lavender flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4" aria-hidden />
      </span>
      {label}
    </div>
  )
}

export default function ProductDetailClient() {
  // The shell HTML is served for ALL /product/* URLs via the SWA rewrite rule.
  // useParams() would return '__shell__' (from the server-rendered router state),
  // so we read window.location.pathname directly after mount to get the real ID.
  const [id, setId] = useState<string | null>(null)

  useEffect(() => {
    // pathname: /product/lippan-34cb30c7/  →  parts[1] = 'lippan-34cb30c7'
    const parts = window.location.pathname.split('/').filter(Boolean)
    setId(parts[1] ?? null)
  }, [])

  const user = useUserAuth((s) => s.user)
  const queryClient = useQueryClient()

  // Review form state
  const [showForm, setShowForm] = useState(false)
  const [formRating, setFormRating] = useState(5)
  const [formTitle, setFormTitle] = useState('')
  const [formBody, setFormBody] = useState('')
  const [formPhotos, setFormPhotos] = useState<string[]>([])
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState(false)

  const { data: productData, isLoading: loadingProduct, isError } = useQuery({
    queryKey: ['product', id],
    queryFn: () => apiFetch<{ product: Product }>(`/products/${id}`),
    enabled: !!id && id !== '__shell__',
    staleTime: 60_000,
  })

  const p = productData?.product
  const category = p ? CATEGORY_BY_SLUG[p.category] : undefined

  const { data: relatedData } = useQuery({
    queryKey: ['products', 'category', p?.category],
    queryFn: () => apiFetch<{ products: Product[] }>(`/products?category=${p!.category}`),
    enabled: !!p?.category,
    staleTime: 60_000,
  })

  interface ReviewApi {
    id: string
    userName: string
    rating: number
    title?: string
    body: string
    createdAt: string
  }

  const { data: reviewsData } = useQuery({
    queryKey: ['reviews', id],
    queryFn: () => apiFetch<{ reviews: ReviewApi[]; total: number; averageRating: number }>(`/reviews/product/${id}`),
    enabled: !!id && id !== '__shell__',
    staleTime: 2 * 60_000,
  })

  // Eligibility pre-flight. Only fires when the user is logged in - the
  // anonymous-state CTA ("Sign in to review") doesn't need a network
  // round-trip. The backend mirrors POST /api/reviews' own checks
  // (verified delivered purchase + one-per-user-product), so the form
  // is only ever shown when the submit will actually succeed.
  type EligibilityReason =
    | 'not-authenticated'
    | 'no-delivered-order'
    | 'already-reviewed'
  const { data: eligibility } = useQuery({
    queryKey: ['review-eligibility', id, user?.email],
    queryFn: () =>
      apiFetch<{ eligible: boolean; reason?: EligibilityReason }>(
        `/reviews/eligibility?productId=${encodeURIComponent(id!)}`,
      ),
    enabled: !!id && id !== '__shell__' && !!user,
    staleTime: 60_000,
  })

  const related = (relatedData?.products ?? []).filter((r) => r.id !== p?.id).slice(0, 4)
  const reviews = reviewsData?.reviews ?? []
  const avgRating = reviewsData?.averageRating ?? 0
  const canReview = !!user && eligibility?.eligible === true

  const submitReview = async () => {
    if (!formBody.trim()) return
    setFormLoading(true)
    setFormError('')
    try {
      await apiFetch('/reviews', {
        method: 'POST',
        body: {
          productId: id,
          rating: formRating,
          title: formTitle.trim() || undefined,
          body: formBody.trim(),
          photos: formPhotos,
        },
      })
      setFormSuccess(true)
      setShowForm(false)
      setFormTitle('')
      setFormBody('')
      setFormRating(5)
      setFormPhotos([])
      queryClient.invalidateQueries({ queryKey: ['reviews', id] })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not submit review. Please try again.'
      setFormError(msg)
    } finally {
      setFormLoading(false)
    }
  }

  if (!id || loadingProduct) return <ProductSkeleton />

  if (isError || !p) {
    return (
      <div className="max-w-6xl mx-auto px-5 pt-20 text-center">
        <h1 className="font-serif text-3xl text-ink mb-4">Product not found</h1>
        <p className="text-ink-soft mb-8">This product may have been removed or the link is incorrect.</p>
        <Link href="/shop" className="inline-flex h-11 px-6 items-center rounded-lg bg-lavender text-white text-sm font-medium hover:bg-lavender/90 transition-colors">
          Browse the shop
        </Link>
      </div>
    )
  }

  const pct = discountPct(p.price, p.compareAtPrice)

  // Per-product Product + Offer JSON-LD. Injected only after data resolves
  // so the fields reflect real stock + price. Googlebot executes the page's
  // JS on subsequent crawls and picks this up; static-HTML-only crawlers
  // (Bing, social previews) see nothing here today — that's the trade-off
  // of running the catalog through a __shell__ SPA on SWA Free.
  const SITE = 'https://www.srilatha.art'
  const productLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.title,
    description: p.shortDescription || p.description,
    sku: p.id,
    category: category?.title || p.category,
    image: (p.images.length > 0 ? p.images : ['/Logos/logo.png']).map((src) =>
      src.startsWith('http') ? src : `${SITE}${src}`,
    ),
    brand: { '@type': 'Brand', name: 'Srilatha Art' },
    ...(typeof p.rating === 'number' && p.reviewCount && p.reviewCount > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: p.rating,
            reviewCount: p.reviewCount,
          },
        }
      : {}),
    offers: {
      '@type': 'Offer',
      url: `${SITE}/product/${p.id}`,
      priceCurrency: 'INR',
      price: p.price.toFixed(2),
      availability: p.inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: 'Srilatha Art' },
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productLd) }}
      />
      <div className="max-w-6xl mx-auto lg:grid lg:grid-cols-2 lg:gap-14 lg:px-8 lg:pt-10">
        {/* Gallery */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          <div className="lg:rounded-[32px] overflow-hidden bg-cream-deep">
            <div className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide aspect-[4/5]">
              {(p.images.length > 0 ? p.images : ['/Logos/logo.png']).map((src, i) => (
                <div key={i} className="relative shrink-0 w-full snap-center">
                  <Image
                    src={src}
                    alt={`${p.title} - image ${i + 1}`}
                    fill
                    sizes="(min-width: 1024px) 50vw, 100vw"
                    priority={i === 0}
                    className="object-contain p-8 lg:p-16"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="px-5 lg:px-0 pt-8 lg:pt-0 pb-32 lg:pb-12">
          <Link
            href={`/shop/${category?.slug}`}
            className="inline-flex items-center gap-1 text-xs text-ink-mute hover:text-lavender transition-colors mb-4"
          >
            <ChevronLeft className="w-3.5 h-3.5" aria-hidden />
            {category?.title}
          </Link>

          <div className="flex items-start justify-between gap-3 mb-4">
            <h1 className="display text-3xl md:text-4xl lg:text-5xl flex-1">{p.title}</h1>
            <div className="hidden sm:flex flex-col gap-2 shrink-0 pt-1">
              <Link
                href={`/custom-order?source=${encodeURIComponent(p.id)}&intent=gift`}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-xs font-medium transition-all duration-300 hover:-translate-y-px hover:bg-accent/5 active:scale-[0.98] whitespace-nowrap"
                style={{ border: '1.5px solid var(--accent)', color: 'var(--accent)' }}
              >
                <Gift className="w-3.5 h-3.5 shrink-0" aria-hidden />
                Gift this piece
              </Link>
              <Link
                href={`/custom-order?source=${encodeURIComponent(p.id)}`}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-xs font-medium transition-all duration-300 hover:-translate-y-px hover:bg-accent/5 active:scale-[0.98] whitespace-nowrap"
                style={{ border: '1.5px solid var(--accent)', color: 'var(--accent)' }}
              >
                <Pencil className="w-3.5 h-3.5 shrink-0" aria-hidden />
                Customize this piece
              </Link>
            </div>
          </div>
          {/* Mobile: gift + customize buttons below title */}
          <div className="sm:hidden flex gap-2 mb-4">
            <Link
              href={`/custom-order?source=${encodeURIComponent(p.id)}&intent=gift`}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-all duration-300 active:scale-[0.98]"
              style={{ border: '1.5px solid var(--accent)', color: 'var(--accent)' }}
            >
              <Gift className="w-3 h-3 shrink-0" aria-hidden />
              Gift this
            </Link>
            <Link
              href={`/custom-order?source=${encodeURIComponent(p.id)}`}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-all duration-300 active:scale-[0.98]"
              style={{ border: '1.5px solid var(--accent)', color: 'var(--accent)' }}
            >
              <Pencil className="w-3 h-3 shrink-0" aria-hidden />
              Customize
            </Link>
          </div>

          {p.rating !== undefined && (
            <div className="flex items-center gap-2 mb-5">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={
                      i < Math.round(p.rating ?? 0)
                        ? 'w-3.5 h-3.5 fill-gold text-gold'
                        : 'w-3.5 h-3.5 text-ink/15'
                    }
                    aria-hidden
                  />
                ))}
              </div>
              <span className="text-xs text-ink-mute">
                {p.rating?.toFixed(1)} · {p.reviewCount} reviews
              </span>
            </div>
          )}

          <div className="flex items-baseline gap-3 mb-1">
            <span className="font-serif text-3xl font-semibold text-ink tabular-nums">{formatINR(p.price)}</span>
            {p.compareAtPrice && (
              <>
                <span className="text-ink-mute line-through tabular-nums">{formatINR(p.compareAtPrice)}</span>
                {pct !== null && (
                  <span className="text-[10px] tracking-[0.18em] uppercase font-bold text-cream bg-lavender px-2 py-1 rounded-full">
                    Save {pct}%
                  </span>
                )}
              </>
            )}
          </div>
          <p className="text-xs text-ink-mute mb-7">Inclusive of all</p>

          <div className="flex flex-wrap gap-2 mb-7">
            <Pill label={p.size} />
            <Pill label={p.material} />
            <Pill label={`Ships in ${p.timeToMake}`} />
          </div>

          {/*
            Trust strip - moved above the description so the buyer sees the
            three reassurances at the exact moment of price decision (audit
            §3). Four signals: handmade by Srilatha (provenance), ships in N
            (lead-time honesty), free shipping (cost surprise removed),
            7-day returns (return-anxiety removed). These are the four
            objections a first-time visitor surfaces while looking at a
            handcrafted piece they have never held.
          */}
          <div className="card-cream p-4 sm:p-5 mb-7 grid grid-cols-2 gap-3 sm:gap-4">
            <Feature icon={Hand} label="Handmade by Srilatha" />
            <Feature icon={Sparkles} label={`Ships in ${p.timeToMake}`} />
            <Feature icon={Truck} label={<>Free shipping above <FreeShippingThreshold /></>} />
            <Feature icon={ShieldCheck} label="7-day easy returns" />
          </div>

          {/* Low-stock urgency cue - honest, since handcrafted is genuinely
              limited. Only fires when stock is positive but ≤ 2. */}
          {p.inStock && p.stockQty > 0 && p.stockQty <= 2 && (
            <p className="mb-7 inline-flex items-center gap-2 text-sm font-medium text-lavender bg-lavender/10 px-3 py-2 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-lavender animate-pulse" aria-hidden />
              Only {p.stockQty} left - each piece is unique
            </p>
          )}

          <p className="text-ink/85 leading-relaxed mb-7 text-base lg:text-lg">{p.description}</p>

          <details className="border-t border-ink/10 py-5 group">
            <summary className="cursor-pointer flex items-center justify-between text-ink font-medium font-serif text-lg">
              Care instructions
              <span className="text-ink-mute group-open:rotate-45 transition-transform" aria-hidden>＋</span>
            </summary>
            <p className="text-ink-soft text-sm leading-relaxed mt-3">{p.careInstructions}</p>
          </details>

          <details className="border-t border-ink/10 py-5 group">
            <summary className="cursor-pointer flex items-center justify-between text-ink font-medium font-serif text-lg">
              Shipping & returns
              <span className="text-ink-mute group-open:rotate-45 transition-transform" aria-hidden>＋</span>
            </summary>
            <p className="text-ink-soft text-sm leading-relaxed mt-3">
              We ship from Hyderabad. Most orders reach you in 5–7 working days. You can return
              unused items within 7 days of delivery.{' '}
              <Link href="/shipping-and-returns" className="text-lavender hover:underline">
                Read the full policy
              </Link>
              .
            </p>
          </details>
        </div>
      </div>

      {related.length > 0 && (
        <section className="max-w-6xl mx-auto pt-14 pb-20">
          <h2 className="font-serif text-3xl lg:text-4xl text-ink px-5 lg:px-8 mb-8">
            You may also <em className="italic">like</em>
          </h2>
          <div className="lg:hidden flex gap-4 overflow-x-auto snap-x snap-mandatory px-5 pb-2 scrollbar-hide">
            {related.map((r) => (
              <ProductCard key={r.id} product={r} variant="carousel" />
            ))}
            <div className="shrink-0 w-2" aria-hidden />
          </div>
          <div className="hidden lg:grid grid-cols-4 gap-7 px-8">
            {related.map((r) => (
              <ProductCard key={r.id} product={r} />
            ))}
          </div>
        </section>
      )}

      {/* Reviews section */}
      <section className="max-w-6xl mx-auto px-5 lg:px-8 pt-16 pb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-serif text-3xl lg:text-4xl text-ink">
              Customer <em className="italic">reviews</em>
            </h2>
            {reviews.length > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={i < Math.round(avgRating) ? 'w-4 h-4 fill-gold text-gold' : 'w-4 h-4 text-ink/15'}
                      aria-hidden
                    />
                  ))}
                </div>
                <span className="text-sm text-ink-soft">{avgRating.toFixed(1)} · {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}</span>
              </div>
            )}
          </div>
          {canReview && !showForm && !formSuccess && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-lg border border-ink/15 text-sm text-ink hover:bg-cream-deep transition-colors"
            >
              <MessageSquare className="w-4 h-4" aria-hidden />
              Write a review
            </button>
          )}
        </div>

        {/* Contextual eligibility messaging - explains WHY the user
            can't write a review instead of letting them fill the form
            and hit a 401/403 on submit. */}
        {!showForm && !formSuccess && user && eligibility?.eligible === false && (
          <p className="text-sm text-ink-mute mb-6">
            {eligibility.reason === 'already-reviewed'
              ? 'Thanks - you’ve already shared a review for this piece.'
              : eligibility.reason === 'no-delivered-order'
                ? 'Only customers who’ve received this piece can leave a review.'
                : null}
          </p>
        )}
        {!showForm && !formSuccess && !user && reviews.length > 0 && (
          <p className="text-sm text-ink-mute mb-6">
            <Link href="/login" className="text-lavender hover:underline">Sign in</Link>{' '}
            to leave a review on a piece you’ve received.
          </p>
        )}

        {/* Review submission form */}
        {showForm && (
          <div className="card p-6 mb-8">
            <h3 className="font-serif text-xl text-ink mb-4">Write your review</h3>
            <div className="mb-4">
              <label className="block text-xs text-ink-mute mb-2 tracking-wider uppercase">Rating</label>
              <div className="flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <button key={i} onClick={() => setFormRating(i + 1)} aria-label={`${i + 1} star`}>
                    <Star
                      className={i < formRating ? 'w-6 h-6 fill-gold text-gold' : 'w-6 h-6 text-ink/20 hover:text-gold/60'}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-xs text-ink-mute mb-1 tracking-wider uppercase">Title (optional)</label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="A short title for your review"
                className="w-full h-10 px-4 rounded-xl border border-ink/15 bg-paper text-sm text-ink placeholder:text-ink-mute focus:outline-none focus:ring-2 focus:ring-lavender/30 focus:border-lavender/50"
              />
            </div>
            <div className="mb-4">
              <label className="block text-xs text-ink-mute mb-1 tracking-wider uppercase">Review</label>
              <textarea
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
                rows={4}
                placeholder="Tell us what you liked or didn’t…"
                className="w-full px-4 py-3 rounded-xl border border-ink/15 bg-paper text-sm text-ink placeholder:text-ink-mute focus:outline-none focus:ring-2 focus:ring-lavender/30 focus:border-lavender/50 resize-none"
              />
            </div>
            <div className="mb-4">
              <PhotoUploader
                value={formPhotos}
                onChange={setFormPhotos}
                max={6}
                label="Photos (optional)"
                hint="Show off the piece in your space - up to 6 photos, 5 MB each."
              />
            </div>
            {formError && <p className="text-xs text-red-600 mb-3">{formError}</p>}
            <div className="flex gap-3">
              <button
                onClick={submitReview}
                disabled={formLoading || !formBody.trim()}
                className="h-10 px-6 rounded-lg bg-lavender text-white text-sm font-medium disabled:opacity-50 hover:bg-lavender/90 transition-colors"
              >
                {formLoading ? 'Submitting…' : 'Submit review'}
              </button>
              <button
                onClick={() => { setShowForm(false); setFormError('') }}
                className="h-10 px-5 rounded-lg border border-ink/15 text-sm text-ink hover:bg-cream-deep transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {formSuccess && (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-5 py-4 mb-6 text-sm text-emerald-700">
            Thanks for the review! We’ll publish it on the site shortly after a quick check.
          </div>
        )}

        {/* Review list */}
        {reviews.length === 0 ? (
          <div className="text-center py-12 text-ink-soft">
            <Star className="w-8 h-8 text-ink/15 mx-auto mb-3" aria-hidden />
            <p className="text-sm">No reviews yet. Be the first to leave one!</p>
            {!user && (
              <Link href="/login" className="mt-3 inline-block text-sm text-lavender hover:underline">
                Sign in to leave a review
              </Link>
            )}
          </div>
        ) : (
          <ul className="space-y-6">
            {reviews.map((r) => (
              <li key={r.id} className="border-t border-ink/10 pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-ink text-sm">{r.userName}</p>
                    <div className="flex items-center gap-1 mt-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={i < r.rating ? 'w-3.5 h-3.5 fill-gold text-gold' : 'w-3.5 h-3.5 text-ink/15'}
                          aria-hidden
                        />
                      ))}
                    </div>
                  </div>
                  <time className="text-xs text-ink-mute shrink-0">
                    {new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </time>
                </div>
                {r.title && <p className="font-medium text-ink mt-2">{r.title}</p>}
                <p className="text-ink/85 text-sm leading-relaxed mt-1">{r.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <StickyCartBar product={p} />
    </>
  )
}
