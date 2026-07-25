'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Star, CheckCircle2, EyeOff, MessageSquare, Clock } from 'lucide-react'
import { formatDate } from '@/lib/format'
import { apiFetch } from '@/lib/api'

type ReviewStatus = 'pending' | 'approved' | 'hidden'

interface Review {
  id: string
  productId: string
  productName?: string
  userName: string
  rating: number
  title?: string
  body: string
  status: ReviewStatus
  adminReply?: string
  createdAt: string
}

const STATUS_CONFIG: Record<ReviewStatus, { label: string; color: string; icon: typeof Clock }> = {
  pending:  { label: 'Pending',  color: 'bg-amber-50 text-amber-700 ring-amber-600/20',  icon: Clock },
  approved: { label: 'Approved', color: 'bg-green-50 text-green-700 ring-green-600/20',   icon: CheckCircle2 },
  hidden:   { label: 'Hidden',   color: 'bg-red-50 text-red-700 ring-red-600/10',          icon: EyeOff },
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i <= rating ? 'text-amber-400 fill-amber-400' : 'text-ink/10'}`}
        />
      ))}
    </div>
  )
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'all' | ReviewStatus>('all')
  const [search, setSearch] = useState('')
  const [updating, setUpdating] = useState<string | null>(null)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')

  const fetchReviews = useCallback(async () => {
    try {
      const data = await apiFetch<{ reviews: Review[] }>('/admin/reviews')
      setReviews(data.reviews ?? [])
    } catch (err) {
      console.error('Failed to load reviews', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchReviews() }, [fetchReviews])

  const updateStatus = async (id: string, status: ReviewStatus) => {
    setUpdating(id)
    try {
      await apiFetch(`/admin/reviews/${id}`, { method: 'PATCH', body: { status } })
      setReviews((prev) => prev.map((r) => r.id === id ? { ...r, status } : r))
    } catch (err) {
      console.error('Failed to update review', err)
      alert('Failed to update review. Please try again.')
    } finally {
      setUpdating(null)
    }
  }

  const submitReply = async (id: string) => {
    if (!replyText.trim()) return
    setUpdating(id)
    try {
      await apiFetch(`/admin/reviews/${id}`, {
        method: 'PATCH',
        body: { adminReply: replyText.trim(), status: 'approved' },
      })
      setReviews((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, adminReply: replyText.trim(), status: 'approved' }
            : r,
        ),
      )
      setReplyingTo(null)
      setReplyText('')
    } catch (err) {
      console.error('Failed to submit reply', err)
      alert('Failed to submit reply. Please try again.')
    } finally {
      setUpdating(null)
    }
  }

  const filtered = reviews.filter((r) => {
    if (activeTab !== 'all' && r.status !== activeTab) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        r.userName.toLowerCase().includes(q) ||
        (r.productName?.toLowerCase().includes(q) ?? false) ||
        r.body.toLowerCase().includes(q)
      )
    }
    return true
  })

  const pendingCount = reviews.filter((r) => r.status === 'pending').length

  return (
    <div>
      <header className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl text-ink mb-1">Reviews</h1>
          <p className="text-ink-soft text-sm">
            Moderate customer reviews.
            {pendingCount > 0 && (
              <span className="ml-1 text-lavender font-medium">
                {pendingCount} awaiting moderation.
              </span>
            )}
          </p>
        </div>
      </header>

      {/* Tabs */}
      <div className="chip-rail mb-6">
        <button onClick={() => setActiveTab('all')} className={`chip ${activeTab === 'all' ? 'is-active' : ''}`}>
          All ({reviews.length})
        </button>
        {(['pending', 'approved', 'hidden'] as ReviewStatus[]).map((s) => {
          const count = reviews.filter((r) => r.status === s).length
          return (
            <button key={s} onClick={() => setActiveTab(s)} className={`chip ${activeTab === s ? 'is-active' : ''}`}>
              {STATUS_CONFIG[s].label} ({count})
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-md mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-mute" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search reviews..."
          className="w-full pl-10 pr-4 h-10 bg-plum-light border border-ink/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent"
        />
      </div>

      {/* Review Cards */}
      <div className="space-y-4">
        {loading && (
          <div className="bg-plum-light border border-ink/10 rounded-lg p-8 text-center">
            <p className="text-ink-soft text-sm">Loading reviews…</p>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="bg-plum-light border border-ink/10 rounded-lg p-8 text-center">
            <MessageSquare className="w-8 h-8 text-ink-mute mx-auto mb-3" />
            <p className="text-ink font-medium mb-1">No reviews found</p>
            <p className="text-sm text-ink-soft">Try adjusting your filters.</p>
          </div>
        )}

        {filtered.map((review) => {
          const cfg = STATUS_CONFIG[review.status]
          const Icon = cfg.icon
          const isUpdating = updating === review.id
          const isReplying = replyingTo === review.id

          return (
            <div
              key={review.id}
              className="bg-plum-light border border-ink/10 rounded-lg p-4 md:p-6 hover:border-lavender/30 transition-colors"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-medium text-ink">{review.userName}</span>
                    <Stars rating={review.rating} />
                  </div>
                  <p className="text-xs text-ink-mute">
                    {review.productName && (
                      <>on <span className="font-medium">{review.productName}</span><span className="mx-1.5">·</span></>
                    )}
                    {formatDate(review.createdAt)}
                  </p>
                </div>
                <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ring-1 ring-inset ${cfg.color}`}>
                  <Icon className="w-3 h-3" />
                  {cfg.label}
                </span>
              </div>

              {/* Body */}
              {review.title && (
                <p className="font-medium text-ink text-sm mb-1">&ldquo;{review.title}&rdquo;</p>
              )}
              <p className="text-sm text-ink-soft mb-4">{review.body}</p>

              {/* Admin Reply */}
              {review.adminReply && (
                <div className="bg-lavender-pastel/10 border border-lavender/20 rounded-lg p-3 mb-4">
                  <p className="text-xs font-medium text-lavender mb-1">Your reply</p>
                  <p className="text-sm text-ink-soft">{review.adminReply}</p>
                </div>
              )}

              {/* Reply textarea */}
              {isReplying && (
                <div className="mb-4">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write your reply…"
                    rows={3}
                    className="w-full px-3 py-2 bg-white border border-ink/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lavender resize-none"
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => submitReply(review.id)}
                      disabled={isUpdating || !replyText.trim()}
                      className="btn-dark text-xs h-8 px-3 disabled:opacity-50"
                    >
                      {isUpdating ? 'Sending…' : 'Send Reply'}
                    </button>
                    <button
                      onClick={() => { setReplyingTo(null); setReplyText('') }}
                      className="text-xs text-ink-mute hover:text-ink px-2"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 flex-wrap">
                {review.status !== 'approved' && (
                  <button
                    onClick={() => updateStatus(review.id, 'approved')}
                    disabled={isUpdating}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 hover:text-green-800 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {isUpdating ? 'Updating…' : 'Approve'}
                  </button>
                )}
                {review.status !== 'hidden' && (
                  <button
                    onClick={() => updateStatus(review.id, 'hidden')}
                    disabled={isUpdating}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-700 transition-colors disabled:opacity-50"
                  >
                    <EyeOff className="w-4 h-4" />
                    {isUpdating ? 'Updating…' : 'Hide'}
                  </button>
                )}
                {!review.adminReply && !isReplying && (
                  <button
                    onClick={() => setReplyingTo(review.id)}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-lavender hover:text-lavender-pastel transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Reply
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
