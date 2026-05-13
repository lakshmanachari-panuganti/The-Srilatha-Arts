'use client'

import { useState } from 'react'
import { Search, Eye, MessageSquare, Clock, CheckCircle2, Palette, Sparkles } from 'lucide-react'
import { formatDate } from '@/lib/format'

type CustomOrderStatus = 'NEW' | 'QUOTED' | 'APPROVED' | 'IN_PROGRESS' | 'COMPLETED'

interface CustomOrder {
  id: string
  status: CustomOrderStatus
  customerName: string
  customerEmail: string
  customerPhone: string
  artForm: string
  description: string
  budget?: string
  quotedAmount?: number
  createdAt: string
}

// Mock data until API is wired
const MOCK_INQUIRIES: CustomOrder[] = [
  {
    id: 'cust-001',
    status: 'NEW',
    customerName: 'Meera Reddy',
    customerEmail: 'meera@example.com',
    customerPhone: '+91 98765 43210',
    artForm: 'Dot Mandala',
    description: 'A 16" mandala in blues and golds for my living room wall.',
    budget: '₹5,000 – ₹8,000',
    createdAt: '2026-05-12T10:30:00Z',
  },
  {
    id: 'cust-002',
    status: 'QUOTED',
    customerName: 'Arjun Desai',
    customerEmail: 'arjun.d@example.com',
    customerPhone: '+91 87654 32109',
    artForm: 'Resin',
    description: 'River table coasters set (6 pcs) with teal and gold.',
    budget: '₹3,000 – ₹5,000',
    quotedAmount: 420000,
    createdAt: '2026-05-10T14:15:00Z',
  },
  {
    id: 'cust-003',
    status: 'IN_PROGRESS',
    customerName: 'Kavitha Nair',
    customerEmail: 'kavitha@example.com',
    customerPhone: '+91 76543 21098',
    artForm: 'Lippan',
    description: 'Peacock motif Lippan panel, 24" square, for Diwali gifting.',
    budget: '₹8,000 – ₹12,000',
    quotedAmount: 950000,
    createdAt: '2026-05-05T09:00:00Z',
  },
  {
    id: 'cust-004',
    status: 'COMPLETED',
    customerName: 'Sanjay Kumar',
    customerEmail: 'sanjay.k@example.com',
    customerPhone: '+91 65432 10987',
    artForm: 'Pichwai',
    description: 'Miniature Shrinathji for home temple, 12" × 16".',
    budget: '₹6,000 – ₹10,000',
    quotedAmount: 750000,
    createdAt: '2026-04-28T11:30:00Z',
  },
]

const STATUS_CONFIG: Record<CustomOrderStatus, { label: string; color: string; icon: typeof Clock }> = {
  NEW:         { label: 'New',         color: 'bg-blue-50 text-blue-700 ring-blue-600/20',     icon: Sparkles },
  QUOTED:      { label: 'Quoted',      color: 'bg-amber-50 text-amber-700 ring-amber-600/20',  icon: MessageSquare },
  APPROVED:    { label: 'Approved',    color: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20', icon: CheckCircle2 },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-purple-50 text-purple-700 ring-purple-600/20', icon: Palette },
  COMPLETED:   { label: 'Completed',   color: 'bg-green-50 text-green-700 ring-green-600/20',  icon: CheckCircle2 },
}

const STATUSES: CustomOrderStatus[] = ['NEW', 'QUOTED', 'APPROVED', 'IN_PROGRESS', 'COMPLETED']

export default function AdminCustomOrdersPage() {
  const [activeTab, setActiveTab] = useState<'ALL' | CustomOrderStatus>('ALL')
  const [search, setSearch] = useState('')

  const filtered = MOCK_INQUIRIES.filter((o) => {
    if (activeTab !== 'ALL' && o.status !== activeTab) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        o.customerName.toLowerCase().includes(q) ||
        o.artForm.toLowerCase().includes(q) ||
        o.id.includes(q)
      )
    }
    return true
  })

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-serif text-3xl text-ink mb-1">Custom Orders</h1>
        <p className="text-ink-soft text-sm">Manage custom art inquiries and commissions.</p>
      </header>

      {/* Status Tabs - horizontal scroll on mobile */}
      <div className="chip-rail mb-6">
        <button
          onClick={() => setActiveTab('ALL')}
          className={`chip ${activeTab === 'ALL' ? 'is-active' : ''}`}
        >
          All ({MOCK_INQUIRIES.length})
        </button>
        {STATUSES.map((s) => {
          const count = MOCK_INQUIRIES.filter((o) => o.status === s).length
          return (
            <button
              key={s}
              onClick={() => setActiveTab(s)}
              className={`chip ${activeTab === s ? 'is-active' : ''}`}
            >
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
          placeholder="Search by name, art form, or ID..."
          className="w-full pl-10 pr-4 h-10 bg-plum-light border border-ink/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent"
        />
      </div>

      {/* Cards - mobile-first card layout */}
      <div className="space-y-4">
        {filtered.length === 0 && (
          <div className="bg-plum-light border border-ink/10 rounded-xl p-8 text-center">
            <Palette className="w-8 h-8 text-ink-mute mx-auto mb-3" />
            <p className="text-ink font-medium mb-1">No inquiries found</p>
            <p className="text-sm text-ink-soft">Try adjusting your filters.</p>
          </div>
        )}

        {filtered.map((order) => {
          const cfg = STATUS_CONFIG[order.status]
          const Icon = cfg.icon
          return (
            <div
              key={order.id}
              className="bg-plum-light border border-ink/10 rounded-xl p-4 md:p-6 hover:border-lavender/30 transition-colors group"
            >
              <div className="flex flex-col md:flex-row md:items-start gap-4">
                {/* Left: info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ring-1 ring-inset ${cfg.color}`}>
                      <Icon className="w-3 h-3" />
                      {cfg.label}
                    </span>
                    <span className="text-xs text-ink-mute">{order.id}</span>
                  </div>

                  <h3 className="font-medium text-ink mb-1 group-hover:text-plum transition-colors">
                    {order.customerName}
                  </h3>
                  <p className="text-sm text-ink-soft mb-2">
                    <span className="font-medium text-lavender">{order.artForm}</span>
                    {order.budget && <span className="ml-2">· Budget: {order.budget}</span>}
                  </p>
                  <p className="text-sm text-ink-soft line-clamp-2">{order.description}</p>
                </div>

                {/* Right: meta + actions */}
                <div className="flex flex-row md:flex-col items-center md:items-end gap-3 md:gap-2 shrink-0">
                  <span className="text-xs text-ink-mute">{formatDate(order.createdAt)}</span>
                  <button className="inline-flex items-center gap-1.5 text-sm font-medium text-terracotta hover:text-plum transition-colors">
                    <Eye className="w-4 h-4" />
                    <span className="hidden md:inline">View Details</span>
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
