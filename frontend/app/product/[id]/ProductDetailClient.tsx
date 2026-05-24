'use client'

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import Image from 'next/image'
import { Star, Hand, Sparkles, Truck, ChevronLeft, MessageSquare } from 'lucide-react'
import { CATEGORY_BY_SLUG } from '@/data/categories'
import { formatINR, discountPct } from '@/lib/format'
import { apiFetch } from '@/lib/api'
import { useUserAuth } from '@/stores/userAuth'
import StickyCartBar from '@/components/shop/StickyCartBar'
import ProductCard from '@/components/shop/ProductCard'
import type { Product } from '@/types'

function ProductSkeleton() {
  return (
    <div className="max-w-6xl mx-auto lg:grid lg:grid-cols-2 lg:gap-14 lg:px-8 lg:pt-10 animate-pulse">
      <div className="lg:rounded-[32px] overflow-hidden bg-purple-200/35 aspect-[4/5]" />
      <div className="px-5 lg:px-0 pt-8 space-y-4">
        <div className="h-4 w-24 bg-purple-200/40 rounded" />
        <div className="h-10 w-3/4 bg-purple-200/40 rounded" />
        <div className="h-8 w-1/3 bg-purple-200/40 rounded" />
        <div className="h-32 bg-purple-200/40 rounded" />
      </div>
    </div>
  )
}

function Pill({ label }: { label: string }) {
  return (
    <span className="inline-flex h-9 px-4 items-center rounded-full border border-purple-200 bg-white/60 text-xs font-bold text-purple-900">
      {label}
    </span>
  )
}

function Feature({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex items-center gap-3 text-sm font-bold text-purple-900">
      <span className="w-9 h-9 rounded-full bg-white/70 border border-purple-200 text-pink-500 flex items-center justify-center shrink-0 shadow-sm">
        <Icon className="w-4 h-4" aria-hidden />
      </span>
      {label}
    </div>
  )
}

export default function ProductDetailClient() {
  const [id, setId] = useState<string | null>(null)

  useEffect(() => {
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

  const related = (relatedData?.products ?? []).filter((r) => r.id !== p?.id).slice(0, 4)
  const reviews = reviewsData?.reviews ?? []
  const avgRating = reviewsData?.averageRating ?? 0

  const submitReview = async () => {
    if (!formBody.trim()) return
    setFormLoading(true)
    setFormError('')
    try {
      await apiFetch('/reviews', {
        method: 'POST',
        body: { productId: id, rating: formRating, title: formTitle.trim() || undefined, body: formBody.trim() },
      })
      setFormSuccess(true)
      setShowForm(false)
      setFormTitle('')
      setFormBody('')
      setFormRating(5)
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
        <h1 className="font-serif text-3xl font-bold text-purple-950 mb-4">Product not found</h1>
        <p className="text-purple-900 mb-8 font-medium">This product may have been removed or the link is incorrect.</p>
        <Link href="/shop" className="btn-dark inline-flex items-center">
          Browse the shop
        </Link>
      </div>
    )
  }

  const pct = discountPct(p.price, p.compareAtPrice)

  return (
    <>
      <div className="max-w-6xl mx-auto lg:grid lg:grid-cols-2 lg:gap-14 lg:px-8 lg:pt-10">
        {/* Gallery */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          <div className="lg:rounded-[32px] overflow-hidden bg-purple-100/30 border border-purple-200/50 shadow-md">
            <div className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide aspect-[4/5]">
              {(p.images.length > 0 ? p.images : ['/images/logo.png']).map((src, i) => (
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
            className="inline-flex items-center gap-1 text-xs font-bold text-purple-900/60 hover:text-pink-500 transition-colors mb-4 uppercase tracking-wider"
          >
            <ChevronLeft className="w-3.5 h-3.5" aria-hidden />
            {category?.title}
          </Link>

          <h1 className="display text-3xl md:text-4xl lg:text-5xl mb-4 text-purple-950 font-bold leading-tight">{p.title}</h1>

          {p.rating !== undefined && (
            <div className="flex items-center gap-2 mb-6">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={
                      i < Math.round(p.rating ?? 0)
                        ? 'w-4 h-4 fill-pink-500 text-pink-500'
                        : 'w-4 h-4 text-purple-200'
                    }
                    aria-hidden
                  />
                ))}
              </div>
              <span className="text-xs font-bold text-purple-900/60">
                {p.rating?.toFixed(1)} · {p.reviewCount} reviews
              </span>
            </div>
          )}

          <div className="flex items-baseline gap-3 mb-1">
            <span className="font-serif text-3xl font-black text-purple-950 tabular-nums">{formatINR(p.price)}</span>
            {p.compareAtPrice && (
              <>
                <span className="text-purple-900/40 font-bold line-through tabular-nums">{formatINR(p.compareAtPrice)}</span>
                {pct !== null && (
                  <span className="text-[10px] tracking-[0.18em] font-bold text-white bg-pink-500 px-2 py-1 rounded-full shadow-sm">
                    Save {pct}%
                  </span>
                )}
              </>
            )}
          </div>
          <p className="text-xs font-bold text-purple-900/50 mb-7">Inclusive of all taxes</p>

          <div className="flex flex-wrap gap-2 mb-7">
            <Pill label={p.size} />
            <Pill label={p.material} />
            <Pill label={`Ships in ${p.timeToMake}`} />
          </div>

          <p className="text-purple-900 font-medium leading-relaxed mb-7 text-base lg:text-lg opacity-90">{p.description}</p>

          <div className="card-cream p-6 mb-8 space-y-4">
            <Feature icon={Hand} label="Handmade — every piece is one of a kind" />
            <Feature icon={Sparkles} label={`Made in ${p.timeToMake}`} />
            <Feature icon={Truck} label="Free shipping above ₹2,999 across India" />
          </div>

          <details className="border-t border-purple-200/60 py-5 group">
            <summary className="cursor-pointer flex items-center justify-between text-purple-950 font-bold font-serif text-lg outline-none">
              Care instructions
              <span className="text-purple-400 group-open:rotate-45 transition-transform" aria-hidden>＋</span>
            </summary>
            <p className="text-purple-900/80 font-medium text-sm leading-relaxed mt-3">{p.careInstructions}</p>
          </details>

          <details className="border-t border-purple-200/60 py-5 group">
            <summary className="cursor-pointer flex items-center justify-between text-purple-950 font-bold font-serif text-lg outline-none">
              Shipping & returns
              <span className="text-purple-400 group-open:rotate-45 transition-transform" aria-hidden>＋</span>
            </summary>
            <p className="text-purple-900/80 font-medium text-sm leading-relaxed mt-3">
              We ship from Hyderabad. Most orders reach you in 5–7 working days. You can return
              unused items within 7 days of delivery.{' '}
              <Link href="/shipping-and-returns" className="text-pink-500 font-bold hover:underline">
                Read the full policy
              </Link>
              .
            </p>
          </details>
        </div>
      </div>

      {related.length > 0 && (
        <section className="max-w-6xl mx-auto pt-14 pb-20 border-t border-purple-200/30">
          <h2 className="font-serif text-3xl lg:text-4xl text-purple-950 font-bold px-5 lg:px-8 mb-8">
            You may also <em className="italic">like</em>
          </h2>
          <div className="lg:hidden flex gap-4 overflow-x-auto snap-x snap-mandatory px-5 pb-4 scrollbar-hide">
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
      <section className="max-w-6xl mx-auto px-5 lg:px-8 pt-16 pb-8 border-t border-purple-200/30">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="font-serif text-3xl lg:text-4xl text-purple-950 font-bold">
              Customer <em className="italic">reviews</em>
            </h2>
            {reviews.length > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={i < Math.round(avgRating) ? 'w-4 h-4 fill-pink-500 text-pink-500' : 'w-4 h-4 text-purple-200'}
                      aria-hidden
                    />
                  ))}
                </div>
                <span className="text-sm font-bold text-purple-900/60">{avgRating.toFixed(1)} · {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}</span>
              </div>
            )}
          </div>
          {user && !showForm && !formSuccess && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-full border border-purple-300 text-sm font-bold text-purple-950 bg-white/70 hover:bg-purple-100 transition-colors"
            >
              <MessageSquare className="w-4 h-4 text-purple-950" aria-hidden />
              Write a review
            </button>
          )}
        </div>

        {/* Review submission form */}
        {showForm && (
          <div className="card p-6 mb-8 border border-purple-200/50 bg-white/70">
            <h3 className="font-serif text-xl text-purple-950 font-bold mb-4">Write your review</h3>
            <div className="mb-4">
              <label className="block text-xs font-bold text-purple-900/70 mb-2 tracking-wider uppercase">Rating</label>
              <div className="flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <button key={i} onClick={() => setFormRating(i + 1)} aria-label={`${i + 1} star`}>
                    <Star
                      className={i < formRating ? 'w-6 h-6 fill-pink-500 text-pink-500' : 'w-6 h-6 text-purple-200 hover:text-pink-400'}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-bold text-purple-900/70 mb-1 tracking-wider uppercase">Title (optional)</label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="A short title for your review"
                className="w-full h-10 px-4 rounded-xl border border-purple-200 bg-white/80 text-sm text-purple-950 placeholder:text-purple-700/55 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
              />
            </div>
            <div className="mb-4">
              <label className="block text-xs font-bold text-purple-900/70 mb-1 tracking-wider uppercase">Review</label>
              <textarea
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
                rows={4}
                placeholder="Tell us what you liked or didn’t…"
                className="w-full px-4 py-3 rounded-xl border border-purple-200 bg-white/80 text-sm text-purple-950 placeholder:text-purple-700/55 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent resize-none"
              />
            </div>
            {formError && <p className="text-xs text-red-600 mb-3 font-semibold">{formError}</p>}
            <div className="flex gap-3">
              <button
                onClick={submitReview}
                disabled={formLoading || !formBody.trim()}
                className="btn-dark min-h-10 h-10 px-6"
              >
                {formLoading ? 'Submitting…' : 'Submit review'}
              </button>
              <button
                onClick={() => { setShowForm(false); setFormError('') }}
                className="min-h-10 h-10 px-5 rounded-full border border-purple-200 text-sm font-bold text-purple-950 hover:bg-purple-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {formSuccess && (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-5 py-4 mb-6 text-sm font-bold text-emerald-700">
            Thanks for the review! We’ll publish it on the site shortly after a quick check.
          </div>
        )}

        {/* Review list */}
        {reviews.length === 0 ? (
          <div className="text-center py-12 text-purple-900/50">
            <Star className="w-8 h-8 text-purple-200 mx-auto mb-3" aria-hidden />
            <p className="text-sm font-bold">No reviews yet. Be the first to leave one!</p>
            {!user && (
              <Link href="/login" className="mt-3 inline-block text-sm font-black text-pink-500 hover:underline">
                Sign in to leave a review
              </Link>
            )}
          </div>
        ) : (
          <ul className="space-y-6">
            {reviews.map((r) => (
              <li key={r.id} className="border-t border-purple-100 pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-bold text-purple-950 text-sm">{r.userName}</p>
                    <div className="flex items-center gap-1 mt-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={i < r.rating ? 'w-3.5 h-3.5 fill-pink-500 text-pink-500' : 'w-3.5 h-3.5 text-purple-200'}
                          aria-hidden
                        />
                      ))}
                    </div>
                  </div>
                  <time className="text-xs font-bold text-purple-900/40 shrink-0">
                    {new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </time>
                </div>
                {r.title && <p className="font-bold text-purple-950 mt-2">{r.title}</p>}
                <p className="text-purple-900 font-medium text-sm leading-relaxed mt-1">{r.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <StickyCartBar product={p} />
    </>
  )
}
