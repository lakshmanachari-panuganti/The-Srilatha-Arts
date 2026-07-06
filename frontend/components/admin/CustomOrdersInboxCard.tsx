'use client'

/**
 * CustomOrdersInboxCard — dashboard tile that surfaces newly arrived
 * custom-order inquiries.
 *
 * Polls /api/admin/custom-orders?status=NEW every 30s. Renders unconditionally
 * so studio admins always see the state at a glance (matches the pattern of
 * SystemDiagnosticsCard, which also renders even when nothing is wrong). When
 * there are unhandled inquiries the card highlights the count and shows a
 * preview of the three most recent names + art forms so operators can decide
 * whether to jump in immediately.
 */

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Sparkles, ArrowUpRight, CheckCircle2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'

interface CustomOrder {
  id: string
  status: string
  customerName: string
  customerPhone: string
  artForm: string
  createdAt: string
}

interface ListResponse {
  orders: CustomOrder[]
  total: number
  page: number
  pageSize: number
}

const ART_FORM_LABEL: Record<string, string> = {
  resin: 'Resin Art',
  'dot-mandala': 'Dot Mandala',
  lippan: 'Lippan Art',
  pichwai: 'Pichwai',
  kolam: 'Kolam Art',
  wedding: 'Wedding Decoratives',
  other: 'Custom brief',
}

function relativeAge(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function CustomOrdersInboxCard() {
  const { data, isLoading, isError } = useQuery<ListResponse>({
    queryKey: ['admin-custom-orders', 'NEW'],
    queryFn: () =>
      apiFetch<ListResponse>('/admin/custom-orders?status=NEW&pageSize=3'),
    refetchInterval: 30_000,
    staleTime: 15_000,
  })

  const total = data?.total ?? 0
  const preview = data?.orders?.slice(0, 3) ?? []

  return (
    <section
      aria-labelledby="custom-orders-inbox-heading"
      className={`mb-8 rounded-xl border shadow-sm ${
        total > 0
          ? 'bg-blue-500/10 border-blue-500/30'
          : 'bg-plum-light border-ink/10'
      }`}
    >
      <div className="p-5 lg:p-6">
        <div className="flex items-start gap-4">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              total > 0
                ? 'bg-blue-500/20 text-blue-400'
                : 'bg-lavender-pastel/30 text-lavender'
            }`}
          >
            {total > 0 ? (
              <Sparkles className="w-5 h-5" aria-hidden />
            ) : (
              <CheckCircle2 className="w-5 h-5" aria-hidden />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2
                id="custom-orders-inbox-heading"
                className="font-serif text-lg text-ink"
              >
                New custom order requests
              </h2>
              {total > 0 && (
                <span className="inline-flex items-center rounded-full bg-blue-500/20 text-blue-300 ring-1 ring-blue-400/30 text-xs font-semibold px-2 py-0.5">
                  {total} new
                </span>
              )}
            </div>

            {isLoading ? (
              <p className="text-sm text-ink-soft mt-1">Checking the inbox…</p>
            ) : isError ? (
              <p className="text-sm text-red-400 mt-1">
                Could not load custom order inquiries. Try refreshing.
              </p>
            ) : total === 0 ? (
              <p className="text-sm text-ink-soft mt-1">
                No new inquiries right now. New submissions from the website will show up here.
              </p>
            ) : (
              <>
                <p className="text-sm text-ink-soft mt-1">
                  {total === 1
                    ? '1 request is waiting for a first response.'
                    : `${total} requests are waiting for a first response.`}
                </p>
                <ul className="mt-3 divide-y divide-slate-700/60 rounded-lg bg-slate-900/60 border border-slate-700/50">
                  {preview.map((order) => (
                    <li key={order.id} className="px-3 py-2.5 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-ink font-medium truncate">
                          {order.customerName || 'Unnamed customer'}
                        </p>
                        <p className="text-xs text-ink-soft truncate">
                          {ART_FORM_LABEL[order.artForm] || order.artForm}
                          {order.customerPhone ? ` · ${order.customerPhone}` : ''}
                          {order.createdAt ? ` · ${relativeAge(order.createdAt)}` : ''}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div className="mt-4 flex flex-col sm:flex-row gap-3 sm:items-center">
              <Link
                href="/admin/custom-orders"
                className={`inline-flex items-center gap-2 text-sm font-medium h-9 px-4 rounded-lg transition-colors ${
                  total > 0
                    ? 'bg-blue-600 text-white hover:bg-blue-500'
                    : 'bg-plum text-white hover:bg-plum/90'
                }`}
              >
                Review inquiries
                <ArrowUpRight className="w-4 h-4" aria-hidden />
              </Link>
              {total > 0 && (
                <p className="text-xs text-ink-soft">
                  Studio admins also receive a WhatsApp notification for each new request.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
