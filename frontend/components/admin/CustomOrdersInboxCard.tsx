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
      className={`mb-8 rounded-lg border shadow-sm ${
        total > 0
          ? 'bg-amber-500/[0.06] border-amber-500/40'
          : 'bg-plum-light border-ink/10'
      }`}
    >
      <div className="p-5 lg:p-6">
        <div className="flex items-start gap-4">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              total > 0
                ? 'bg-amber-500/15 text-amber-300'
                : 'bg-lavender-pastel/20 text-blue'
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
                className={`font-serif text-lg ${
                  total > 0 ? 'text-amber-200' : 'text-ink'
                }`}
              >
                New custom order requests
              </h2>
              {total > 0 && (
                <span className="inline-flex items-center rounded-md bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30 text-xs font-semibold px-2 py-0.5">
                  {total} new
                </span>
              )}
            </div>

            {isLoading ? (
              <p className="text-sm text-ink-soft mt-1">Checking the inbox…</p>
            ) : isError ? (
              <p className="text-sm text-red-300 mt-1">
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
                <ul className="mt-3 divide-y divide-amber-500/20 rounded-lg bg-amber-500/[0.04] border border-amber-500/20">
                  {preview.map((order) => (
                    <li key={order.id} className="px-3 py-2.5 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-amber-100 font-medium truncate">
                          {order.customerName || 'Unnamed customer'}
                        </p>
                        <p className="text-xs text-amber-300/70 truncate">
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
                    ? 'bg-amber-500 text-gray-950 hover:bg-amber-400'
                    : 'btn-outline text-ink border border-ink/20'
                }`}
              >
                Review inquiries
                <ArrowUpRight className="w-4 h-4" aria-hidden />
              </Link>
              {total > 0 && (
                <p className="text-xs text-amber-300/60">
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
