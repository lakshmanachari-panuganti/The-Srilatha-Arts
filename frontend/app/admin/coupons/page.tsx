'use client'

import { useState } from 'react'
import { Plus, Search, Ticket, Copy, ToggleLeft, ToggleRight, Trash2, Pencil } from 'lucide-react'
import { formatINR, formatDate } from '@/lib/format'

type CouponType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING'

interface Coupon {
  code: string
  type: CouponType
  value: number
  description?: string
  minOrderAmount?: number
  maxDiscount?: number
  startDate: string
  endDate?: string
  usageLimit?: number
  currentUsage: number
  active: boolean
  firstTimeOnly: boolean
  promoteInBanner: boolean
}

const MOCK_COUPONS: Coupon[] = [
  {
    code: 'SRILATHA30',
    type: 'PERCENTAGE',
    value: 30,
    description: 'Flat 30% off site-wide',
    minOrderAmount: 200000,
    maxDiscount: 300000,
    startDate: '2026-05-01T00:00:00Z',
    endDate: '2026-05-31T23:59:59Z',
    usageLimit: 500,
    currentUsage: 142,
    active: true,
    firstTimeOnly: false,
    promoteInBanner: true,
  },
  {
    code: 'WELCOME200',
    type: 'FIXED_AMOUNT',
    value: 20000,
    description: '₹200 off your first order',
    minOrderAmount: 100000,
    startDate: '2026-01-01T00:00:00Z',
    usageLimit: 1000,
    currentUsage: 387,
    active: true,
    firstTimeOnly: true,
    promoteInBanner: false,
  },
  {
    code: 'FREESHIP',
    type: 'FREE_SHIPPING',
    value: 0,
    description: 'Free shipping on any order',
    startDate: '2026-05-01T00:00:00Z',
    endDate: '2026-06-30T23:59:59Z',
    currentUsage: 58,
    active: true,
    firstTimeOnly: false,
    promoteInBanner: false,
  },
  {
    code: 'RESIN20',
    type: 'PERCENTAGE',
    value: 20,
    description: '20% off Resin Art only',
    startDate: '2026-04-01T00:00:00Z',
    endDate: '2026-04-30T23:59:59Z',
    usageLimit: 200,
    currentUsage: 200,
    active: false,
    firstTimeOnly: false,
    promoteInBanner: false,
  },
]

const TYPE_LABELS: Record<CouponType, string> = {
  PERCENTAGE: '% Off',
  FIXED_AMOUNT: '₹ Off',
  FREE_SHIPPING: 'Free Ship',
}

const TYPE_COLORS: Record<CouponType, string> = {
  PERCENTAGE: 'bg-purple-50 text-purple-700 ring-purple-600/20',
  FIXED_AMOUNT: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  FREE_SHIPPING: 'bg-green-50 text-green-700 ring-green-600/20',
}

function formatCouponValue(coupon: Coupon): string {
  switch (coupon.type) {
    case 'PERCENTAGE': return `${coupon.value}% off`
    case 'FIXED_AMOUNT': return `${formatINR(coupon.value)} off`
    case 'FREE_SHIPPING': return 'Free shipping'
  }
}

export default function AdminCouponsPage() {
  const [search, setSearch] = useState('')
  const [showActive, setShowActive] = useState<'all' | 'active' | 'inactive'>('all')

  const filtered = MOCK_COUPONS.filter((c) => {
    if (showActive === 'active' && !c.active) return false
    if (showActive === 'inactive' && c.active) return false
    if (search) {
      const q = search.toLowerCase()
      return c.code.toLowerCase().includes(q) || (c.description?.toLowerCase().includes(q) ?? false)
    }
    return true
  })

  return (
    <div>
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl text-ink mb-1">Coupons</h1>
          <p className="text-ink-soft text-sm">Create and manage discount codes.</p>
        </div>
        <button className="btn-dark text-sm h-10 px-4 shrink-0 self-start sm:self-auto">
          <Plus className="w-4 h-4 mr-2" />
          New Coupon
        </button>
      </header>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-mute" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by code or description..."
            className="w-full pl-10 pr-4 h-10 bg-plum-light border border-ink/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent"
          />
        </div>
        <div className="chip-rail sm:flex sm:gap-2">
          {(['all', 'active', 'inactive'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setShowActive(tab)}
              className={`chip capitalize ${showActive === tab ? 'is-active' : ''}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Coupon Cards - mobile-first */}
      <div className="space-y-4">
        {filtered.length === 0 && (
          <div className="bg-plum-light border border-ink/10 rounded-xl p-8 text-center">
            <Ticket className="w-8 h-8 text-ink-mute mx-auto mb-3" />
            <p className="text-ink font-medium mb-1">No coupons found</p>
            <p className="text-sm text-ink-soft">Create your first coupon to start offering discounts.</p>
          </div>
        )}

        {filtered.map((coupon) => {
          const isExpired = coupon.endDate && new Date(coupon.endDate).getTime() < Date.now()
          const isMaxed = coupon.usageLimit && coupon.currentUsage >= coupon.usageLimit

          return (
            <div
              key={coupon.code}
              className={`bg-plum-light border rounded-xl p-4 md:p-6 transition-colors ${
                !coupon.active || isExpired || isMaxed
                  ? 'border-ink/5 opacity-70'
                  : 'border-ink/10 hover:border-lavender/30'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-start gap-4">
                {/* Left: code + details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <code className="font-mono text-lg font-bold text-ink tracking-wider">
                      {coupon.code}
                    </code>
                    <button
                      className="text-ink-mute hover:text-lavender transition-colors"
                      title="Copy code"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ring-1 ring-inset ${TYPE_COLORS[coupon.type]}`}>
                      {TYPE_LABELS[coupon.type]}
                    </span>
                    {coupon.firstTimeOnly && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20">
                        First-time
                      </span>
                    )}
                    {coupon.promoteInBanner && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-lavender-pastel/20 text-plum ring-1 ring-inset ring-lavender/30">
                        In Banner
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-medium text-ink mb-1">
                    {formatCouponValue(coupon)}
                    {coupon.minOrderAmount && (
                      <span className="text-ink-soft font-normal ml-1">
                        · Min order {formatINR(coupon.minOrderAmount)}
                      </span>
                    )}
                  </p>

                  {coupon.description && (
                    <p className="text-sm text-ink-soft mb-2">{coupon.description}</p>
                  )}

                  <div className="flex items-center gap-4 text-xs text-ink-mute flex-wrap">
                    <span>
                      {coupon.currentUsage}{coupon.usageLimit ? ` / ${coupon.usageLimit}` : ''} used
                    </span>
                    <span>From {formatDate(coupon.startDate)}</span>
                    {coupon.endDate && (
                      <span className={isExpired ? 'text-red-600 font-medium' : ''}>
                        {isExpired ? 'Expired' : `Until ${formatDate(coupon.endDate)}`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: status + actions */}
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
                      coupon.active
                        ? 'text-green-700 hover:text-green-800'
                        : 'text-ink-mute hover:text-ink'
                    }`}
                    title={coupon.active ? 'Active – click to deactivate' : 'Inactive – click to activate'}
                  >
                    {coupon.active ? (
                      <ToggleRight className="w-5 h-5" />
                    ) : (
                      <ToggleLeft className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    className="text-ink-mute hover:text-plum transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    className="text-ink-mute hover:text-red-600 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
