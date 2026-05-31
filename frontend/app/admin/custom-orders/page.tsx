'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Eye, MessageSquare, Clock, CheckCircle2, Palette, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'
import { formatDate } from '@/lib/format'
import { apiFetch } from '@/lib/api'

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
  adminNote?: string
  createdAt: string
}

const STATUS_CONFIG: Record<CustomOrderStatus, { label: string; color: string; icon: typeof Clock }> = {
  NEW:         { label: 'New',         color: 'bg-blue-50 text-blue-700 ring-blue-600/20',       icon: Sparkles },
  QUOTED:      { label: 'Quoted',      color: 'bg-amber-50 text-amber-700 ring-amber-600/20',    icon: MessageSquare },
  APPROVED:    { label: 'Approved',    color: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20', icon: CheckCircle2 },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-purple-50 text-purple-700 ring-purple-600/20', icon: Palette },
  COMPLETED:   { label: 'Completed',   color: 'bg-green-50 text-green-700 ring-green-600/20',    icon: CheckCircle2 },
}

const STATUSES: CustomOrderStatus[] = ['NEW', 'QUOTED', 'APPROVED', 'IN_PROGRESS', 'COMPLETED']

export default function AdminCustomOrdersPage() {
  const [orders, setOrders] = useState<CustomOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'ALL' | CustomOrderStatus>('ALL')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)

  const fetchOrders = useCallback(async () => {
    try {
      const data = await apiFetch<{ orders: CustomOrder[] }>('/admin/custom-orders')
      setOrders(data.orders ?? [])
    } catch (err) {
      console.error('Failed to load custom orders', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const updateStatus = async (order: CustomOrder, status: CustomOrderStatus) => {
    if (status === order.status) return
    setUpdating(order.id)
    try {
      const data = await apiFetch<{ order: CustomOrder }>(`/admin/custom-orders/${order.id}`, {
        method: 'PATCH',
        body: { status },
      })
      setOrders((prev) => prev.map((o) => (o.id === order.id ? data.order : o)))
    } catch (err) {
      console.error('Failed to update custom order', err)
      alert('Failed to update status. Please try again.')
    } finally {
      setUpdating(null)
    }
  }

  const filtered = orders.filter((o) => {
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

      {/* Status Tabs */}
      <div className="chip-rail mb-6">
        <button
          onClick={() => setActiveTab('ALL')}
          className={`chip ${activeTab === 'ALL' ? 'is-active' : ''}`}
        >
          All ({orders.length})
        </button>
        {STATUSES.map((s) => {
          const count = orders.filter((o) => o.status === s).length
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

      {/* Cards */}
      <div className="space-y-4">
        {loading && (
          <div className="bg-plum-light border border-ink/10 rounded-xl p-8 text-center">
            <p className="text-ink-soft text-sm">Loading custom orders…</p>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="bg-plum-light border border-ink/10 rounded-xl p-8 text-center">
            <Palette className="w-8 h-8 text-ink-mute mx-auto mb-3" />
            <p className="text-ink font-medium mb-1">No inquiries found</p>
            <p className="text-sm text-ink-soft">Try adjusting your filters.</p>
          </div>
        )}

        {filtered.map((order) => {
          const cfg = STATUS_CONFIG[order.status]
          const Icon = cfg.icon
          const isUpdating = updating === order.id
          const isExpanded = expandedId === order.id

          return (
            <div
              key={order.id}
              className="bg-plum-light border border-ink/10 rounded-xl p-4 md:p-6 hover:border-lavender/30 transition-colors"
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

                  <h3 className="font-medium text-ink mb-1">{order.customerName}</h3>
                  <p className="text-sm text-ink-soft mb-2">
                    <span className="font-medium text-lavender capitalize">{order.artForm}</span>
                    {order.budget && <span className="ml-2">· Budget: {order.budget}</span>}
                  </p>
                  <p className="text-sm text-ink-soft line-clamp-2">{order.description}</p>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="mt-3 space-y-2 border-t border-ink/5 pt-3">
                      <p className="text-xs text-ink-mute">
                        <span className="font-medium text-ink">Email:</span>{' '}
                        <a href={`mailto:${order.customerEmail}`} className="text-lavender hover:underline">
                          {order.customerEmail}
                        </a>
                      </p>
                      <p className="text-xs text-ink-mute">
                        <span className="font-medium text-ink">Phone:</span> {order.customerPhone}
                      </p>
                      {order.quotedAmount && (
                        <p className="text-xs text-ink-mute">
                          <span className="font-medium text-ink">Quoted:</span> ₹{(order.quotedAmount / 100).toLocaleString('en-IN')}
                        </p>
                      )}
                      {order.adminNote && (
                        <div className="bg-lavender-pastel/10 border border-lavender/20 rounded-lg p-2">
                          <p className="text-xs font-medium text-lavender mb-0.5">Admin note</p>
                          <p className="text-xs text-ink-soft">{order.adminNote}</p>
                        </div>
                      )}

                      {/* Status change */}
                      <div className="flex items-center gap-2 pt-1">
                        <label className="text-xs font-medium text-ink-soft shrink-0">Move to:</label>
                        <select
                          value={order.status}
                          onChange={(e) => updateStatus(order, e.target.value as CustomOrderStatus)}
                          disabled={isUpdating}
                          className="text-xs px-2 h-8 bg-white border border-ink/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-lavender disabled:opacity-50"
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                          ))}
                        </select>
                        {isUpdating && <span className="text-xs text-ink-mute">Updating…</span>}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: meta + actions */}
                <div className="flex flex-row md:flex-col items-center md:items-end gap-3 md:gap-2 shrink-0">
                  <span className="text-xs text-ink-mute">{formatDate(order.createdAt)}</span>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : order.id)}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-lavender hover:text-lavender-pastel transition-colors"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="w-4 h-4" />
                        <span className="hidden md:inline">Collapse</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4" />
                        <span className="hidden md:inline">View Details</span>
                      </>
                    )}
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