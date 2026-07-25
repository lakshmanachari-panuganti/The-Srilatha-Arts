'use client'

import { useState, useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { Search, Eye, X, Loader2 } from 'lucide-react'
import { formatINR } from '@/lib/format'
import { apiFetch } from '@/lib/api'

const ALL_STATUSES = [
  'PLACED', 'CONFIRMED', 'CRAFTING', 'PACKED', 'SHIPPED',
  'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURN_REQUESTED', 'RETURNED', 'REFUNDED',
  'CANCELLED', 'ON_HOLD',
] as const

const STATUS_LABELS: Record<string, string> = {
  PLACED:           'Placed',
  CONFIRMED:        'Confirmed',
  CRAFTING:         'Crafting',
  PACKED:           'Packed',
  SHIPPED:          'Shipped',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED:        'Delivered',
  RETURN_REQUESTED: 'Return Requested',
  RETURNED:         'Returned',
  REFUNDED:         'Refunded',
  CANCELLED:        'Cancelled',
  ON_HOLD:          'On Hold',
}

const STATUS_COLORS: Record<string, string> = {
  PLACED:           'bg-blue-50 text-blue-700 ring-blue-600/20',
  CONFIRMED:        'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  CRAFTING:         'bg-purple-50 text-purple-700 ring-purple-600/20',
  PACKED:           'bg-yellow-50 text-yellow-800 ring-yellow-600/20',
  SHIPPED:          'bg-orange-50 text-orange-700 ring-orange-600/20',
  OUT_FOR_DELIVERY: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  DELIVERED:        'bg-green-50 text-green-700 ring-green-600/20',
  RETURN_REQUESTED: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  RETURNED:         'bg-gray-50 text-gray-700 ring-gray-600/20',
  REFUNDED:         'bg-teal-50 text-teal-700 ring-teal-600/20',
  CANCELLED:        'bg-red-50 text-red-700 ring-red-600/10',
  ON_HOLD:          'bg-zinc-50 text-zinc-700 ring-zinc-600/20',
}

interface Order {
  id: string
  status: string
  customerName: string
  customerEmail?: string
  displayTotal: number
  paymentStatus?: string
  createdAt: string
}

interface OrdersResponse {
  orders: Order[]
  total: number
  page: number
  size: number
}

const PAGE_SIZE = 20

export default function AdminOrdersPage() {
  const queryClient = useQueryClient()
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)

  // Bulk-update state.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkTo, setBulkTo] = useState<string>('')
  const [bulkNote, setBulkNote] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkResult, setBulkResult] = useState<string>('')

  // Debounce search by 400 ms to avoid hammering the API on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchInput)
      setPage(1)
    }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  // Reset to page 1 whenever the status filter changes.
  useEffect(() => { setPage(1) }, [status])

  // Backend note: when ?status= is set it uses the secondary index (fast).
  // When ?q= is set it does a full table scan. If both are provided the
  // backend status path ignores q, so we send status only when there is no
  // active search term.
  const { data, isLoading, isError } = useQuery<OrdersResponse>({
    queryKey: ['admin-orders', debouncedSearch, status, page],
    queryFn: () =>
      apiFetch<OrdersResponse>('/admin/orders', {
        query: {
          ...(status && !debouncedSearch ? { status } : {}),
          ...(debouncedSearch ? { q: debouncedSearch } : {}),
          page,
          size: PAGE_SIZE,
        },
      }),
    staleTime: 30_000,
  })

  const orders = data?.orders ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const isFiltered = Boolean(debouncedSearch || status)

  // Clear selection whenever the visible page changes - selections shouldn't
  // silently carry across pages (the user can't see what they have selected
  // off-screen anymore).
  useEffect(() => { setSelected(new Set()); setBulkResult('') }, [debouncedSearch, status, page])

  const allOnPageSelected = useMemo(
    () => orders.length > 0 && orders.every((o) => selected.has(o.id)),
    [orders, selected],
  )
  function toggleOne(id: string) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function toggleAll() {
    setSelected((s) => {
      if (orders.every((o) => s.has(o.id))) {
        const next = new Set(s)
        for (const o of orders) next.delete(o.id)
        return next
      }
      const next = new Set(s)
      for (const o of orders) next.add(o.id)
      return next
    })
  }

  async function applyBulk() {
    if (!bulkTo || selected.size === 0) return
    setBulkBusy(true); setBulkResult('')
    try {
      const res = await apiFetch<{ results: { id: string; ok: boolean; error?: string }[] }>(
        '/admin/orders/bulk-status',
        {
          method: 'PATCH',
          body: {
            ids: Array.from(selected),
            to: bulkTo,
            note: bulkNote.trim() || undefined,
          },
        },
      )
      const okCount = res.results.filter((r) => r.ok).length
      const failCount = res.results.length - okCount
      setBulkResult(
        failCount === 0
          ? `Updated ${okCount} order${okCount === 1 ? '' : 's'}.`
          : `Updated ${okCount}, ${failCount} failed. ${
              res.results.filter((r) => !r.ok).map((r) => `${r.id}: ${r.error}`).join(' · ')
            }`,
      )
      setSelected(new Set())
      setBulkNote('')
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] })
    } catch (e) {
      setBulkResult(e instanceof Error ? e.message : 'Bulk update failed')
    } finally {
      setBulkBusy(false)
    }
  }

  return (
    <div>
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl text-ink mb-1">Orders</h1>
          <p className="text-ink-soft text-sm">Manage customer orders and update their status.</p>
        </div>
        {!isLoading && total > 0 && (
          <span className="text-sm text-ink-soft">
            {total} order{total !== 1 ? 's' : ''}
            {isFiltered ? ' matching filters' : ''}
          </span>
        )}
      </header>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-mute" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by order ID, customer name, email or phone…"
            className="w-full pl-10 pr-4 h-10 bg-plum-light border border-ink/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          disabled={Boolean(debouncedSearch)}
          title={debouncedSearch ? 'Clear search text to filter by status' : undefined}
          className="px-4 h-10 bg-plum-light border border-ink/10 rounded-lg text-sm text-ink hover:bg-paper transition-colors focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">All Statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="bg-plum-light border border-ink/10 rounded-lg p-12 text-center text-ink-soft text-sm">
          Loading orders…
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center text-red-700 text-sm">
          Failed to load orders. Please refresh the page.
        </div>
      )}

      {/* Bulk-update toolbar - slides in when ≥1 row selected. Floats above
          the table so it's visible even mid-scroll on long pages. Hits
          PATCH /api/admin/orders/bulk-status. */}
      {selected.size > 0 && (
        <div className="mb-4 rounded-lg border border-lavender/30 bg-lavender-pastel/15 px-4 py-3 flex flex-wrap items-center gap-3">
          <p className="text-sm font-medium text-ink">
            {selected.size} selected
          </p>
          <select
            value={bulkTo}
            onChange={(e) => setBulkTo(e.target.value)}
            className="h-9 px-3 rounded-lg border border-ink/15 bg-white text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender"
          >
            <option value="">Set status to…</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          <input
            type="text"
            value={bulkNote}
            onChange={(e) => setBulkNote(e.target.value)}
            placeholder="Internal note (optional)"
            className="h-9 px-3 rounded-lg border border-ink/15 bg-white text-sm text-ink min-w-[14rem] focus:outline-none focus:ring-2 focus:ring-lavender"
          />
          <button
            onClick={applyBulk}
            disabled={bulkBusy || !bulkTo}
            className="h-9 px-4 rounded-lg bg-lavender text-white text-sm font-medium disabled:opacity-50 hover:bg-lavender/90 inline-flex items-center gap-1.5"
          >
            {bulkBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />}
            {bulkBusy ? 'Updating…' : 'Apply'}
          </button>
          <button
            onClick={() => { setSelected(new Set()); setBulkResult('') }}
            className="h-9 px-3 rounded-lg text-sm text-ink-soft hover:text-ink inline-flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" /> Clear
          </button>
          {bulkResult && (
            <p className="text-xs text-ink-soft w-full break-words">{bulkResult}</p>
          )}
        </div>
      )}

      {/* Orders table */}
      {!isLoading && !isError && (
        <>
          <div className="bg-plum-light border border-ink/10 rounded-lg overflow-x-auto">
            <table className="w-full text-left text-sm text-ink min-w-[850px]">
              <thead className="bg-paper border-b border-ink/10 text-ink-soft font-medium">
                <tr>
                  <th className="px-4 py-4 w-10">
                    <input
                      type="checkbox"
                      aria-label="Select all on this page"
                      checked={allOnPageSelected}
                      onChange={toggleAll}
                      className="accent-lavender"
                    />
                  </th>
                  <th className="px-6 py-4">Order ID</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Total</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/5">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-ink-soft">
                      {isFiltered ? 'No orders match your filters.' : 'No orders yet.'}
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <tr
                      key={order.id}
                      className={`hover:bg-lavender-pastel/10 transition-colors group ${
                        selected.has(order.id) ? 'bg-lavender-pastel/15' : ''
                      }`}
                    >
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          aria-label={`Select order ${order.id}`}
                          checked={selected.has(order.id)}
                          onChange={() => toggleOne(order.id)}
                          className="accent-lavender"
                        />
                      </td>
                      <td className="px-6 py-4 font-medium">{order.id}</td>
                      <td className="px-6 py-4 text-ink-soft">
                        {new Date(order.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </td>
                      <td className="px-6 py-4">
                        {order.customerName}
                        {order.customerEmail && (
                          <span className="text-xs text-ink-mute block mt-0.5">
                            {order.customerEmail}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ring-1 ring-inset ${STATUS_COLORS[order.status] ?? 'bg-gray-50 text-gray-700 ring-gray-600/20'}`}>
                          {STATUS_LABELS[order.status] ?? order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium">
                        {formatINR(order.displayTotal)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/admin/orders/detail?id=${order.id}`}
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-lavender hover:text-lavender-pastel transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-ink-soft">
              <span>Page {page} of {totalPages} ({total} orders)</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg border border-ink/10 disabled:opacity-40 hover:bg-paper transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-lg border border-ink/10 disabled:opacity-40 hover:bg-paper transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

