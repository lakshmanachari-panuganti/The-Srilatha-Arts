'use client'

import { useState } from 'react'
import { Search, Star, CheckCircle2, EyeOff, MessageSquare, Clock } from 'lucide-react'
import { formatDate } from '@/lib/format'

type ReviewStatus = 'pending' | 'approved' | 'hidden'

interface Review {
  id: string
  productId: string
  productName: string
  userName: string
  rating: number
  title?: string
  body: string
  status: ReviewStatus
  adminReply?: string
  createdAt: string
}

const MOCK_REVIEWS: Review[] = [
  {
    id: 'rev-001',
    productId: 'resin-river-tray-large',
    productName: 'Ocean River Resin Tray',
    userName: 'Priya Sharma',
    rating: 5,
    title: 'Absolutely stunning!',
    body: 'The colors are even more vibrant in person. The resin has a glass-like finish that catches the light beautifully.',
    status: 'pending',
    createdAt: '2026-05-11T16:00:00Z',
  },
  {
    id: 'rev-002',
    productId: 'mandala-aurora-12',
    productName: 'Aurora Dot Mandala - 12" Round',
    userName: 'Rajesh K.',
    rating: 4,
    title: 'Beautiful craftsmanship',
    body: 'Got this for my mother\'s birthday. She loved it. Only wish the packaging was slightly sturdier.',
    status: 'pending',
    createdAt: '2026-05-10T09:30:00Z',
  },
  {
    id: 'rev-003',
    productId: 'lippan-peacock-square',
    productName: 'Lippan Peacock - 16" Square',
    userName: 'Ananya R.',
    rating: 5,
    body: 'The mirrors catch the lamp light every evening — it\'s the soul of the room now.',
    status: 'approved',
    adminReply: 'Thank you for the kind words, Ananya! We\'re so glad the piece found its home.',
    createdAt: '2026-05-05T14:20:00Z',
  },
  {
    id: 'rev-004',
    productId: 'resin-cosmos-coasters-4',
    productName: 'Cosmos Resin Coasters (Set of 4)',
    userName: 'Vikram S.',
    rating: 2,
    body: 'One coaster had a small bubble defect. Otherwise the colors are good.',
    status: 'hidden',
    createdAt: '2026-05-03T11:00:00Z',
  },
]

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
  const [activeTab, setActiveTab] = useState<'all' | ReviewStatus>('all')
  const [search, setSearch] = useState('')

  const filtered = MOCK_REVIEWS.filter((r) => {
    if (activeTab !== 'all' && r.status !== activeTab) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        r.userName.toLowerCase().includes(q) ||
        r.productName.toLowerCase().includes(q) ||
        r.body.toLowerCase().includes(q)
      )
    }
    return true
  })

  const pendingCount = MOCK_REVIEWS.filter((r) => r.status === 'pending').length

  return (
    <div>
      <header className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl text-ink mb-1">Reviews</h1>
          <p className="text-ink-soft text-sm">
            Moderate customer reviews.
            {pendingCount > 0 && (
              <span className="ml-1 text-terracotta font-medium">
                {pendingCount} awaiting moderation.
              </span>
            )}
          </p>
        </div>
      </header>

      {/* Tabs */}
      <div className="chip-rail mb-6">
        <button onClick={() => setActiveTab('all')} className={`chip ${activeTab === 'all' ? 'is-active' : ''}`}>
          All ({MOCK_REVIEWS.length})
        </button>
        {(['pending', 'approved', 'hidden'] as ReviewStatus[]).map((s) => {
          const count = MOCK_REVIEWS.filter((r) => r.status === s).length
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
        {filtered.length === 0 && (
          <div className="bg-plum-light border border-ink/10 rounded-xl p-8 text-center">
            <MessageSquare className="w-8 h-8 text-ink-mute mx-auto mb-3" />
            <p className="text-ink font-medium mb-1">No reviews found</p>
            <p className="text-sm text-ink-soft">Try adjusting your filters.</p>
          </div>
        )}

        {filtered.map((review) => {
          const cfg = STATUS_CONFIG[review.status]
          const Icon = cfg.icon
          return (
            <div
              key={review.id}
              className="bg-plum-light border border-ink/10 rounded-xl p-4 md:p-6 hover:border-lavender/30 transition-colors"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-medium text-ink">{review.userName}</span>
                    <Stars rating={review.rating} />
                  </div>
                  <p className="text-xs text-ink-mute">
                    on <span className="font-medium">{review.productName}</span>
                    <span className="mx-1.5">·</span>
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

              {/* Actions */}
              <div className="flex items-center gap-3 flex-wrap">
                {review.status === 'pending' && (
                  <>
                    <button className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 hover:text-green-800 transition-colors">
                      <CheckCircle2 className="w-4 h-4" />
                      Approve
                    </button>
                    <button className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-700 transition-colors">
                      <EyeOff className="w-4 h-4" />
                      Hide
                    </button>
                  </>
                )}
                {review.status === 'approved' && (
                  <button className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-700 transition-colors">
                    <EyeOff className="w-4 h-4" />
                    Hide
                  </button>
                )}
                {review.status === 'hidden' && (
                  <button className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 hover:text-green-800 transition-colors">
                    <CheckCircle2 className="w-4 h-4" />
                    Approve
                  </button>
                )}
                {!review.adminReply && (
                  <button className="inline-flex items-center gap-1.5 text-sm font-medium text-terracotta hover:text-plum transition-colors">
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
