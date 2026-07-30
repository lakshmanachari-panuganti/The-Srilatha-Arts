'use client'

/**
 * NotificationAlertsCard — admin dashboard widget surfacing every
 * customer-facing communication failure that hasn't been acknowledged.
 *
 * The single rule: if it's red, something needs to be done by a human.
 * If it's amber, the queue is still retrying — informational.
 *
 * Polls /api/admin/notification-alerts every 30s via React Query. On
 * Acknowledge the alert disappears from this surface but stays in the
 * audit trail (queryable via /admin/notification-alerts/history later).
 */

import { useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Mail,
  MessageCircle,
  IndianRupee,
  FileText,
  Check,
  ArrowUpRight,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'

interface AlertApi {
  id: string
  orderId: string
  channel: 'email' | 'whatsapp' | 'payment' | 'invoice'
  operation: string
  customerName: string
  customerContact: string
  reason: string
  attempts: number
  isFinal: boolean
  status: 'open' | 'acknowledged'
  firstFailureAt: string
  lastFailureAt: string
}

interface ListResponse {
  alerts: AlertApi[]
  total: number
  finalCount: number
  retryingCount: number
}

const MAX_RETRIES_HINT = 5

export default function NotificationAlertsCard() {
  const qc = useQueryClient()
  const { data, isLoading, isError } = useQuery<ListResponse>({
    queryKey: ['admin-notification-alerts'],
    queryFn: () => apiFetch<ListResponse>('/admin/notification-alerts?limit=50'),
    refetchInterval: 30_000,
    staleTime: 15_000,
  })

  const [busy, setBusy] = useState<string | null>(null)
  const alerts = data?.alerts ?? []

  const acknowledge = async (id: string) => {
    setBusy(id)
    try {
      await apiFetch(`/admin/notification-alerts/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: { status: 'acknowledged' },
      })
      await qc.invalidateQueries({ queryKey: ['admin-notification-alerts'] })
    } catch {
      // surface via a brief in-card error? For now silently keep the row;
      // next poll will reflect actual state.
    } finally {
      setBusy(null)
    }
  }

  if (isLoading) {
    return (
      <section className="bg-plum-light border border-ink/10 rounded-lg p-6 mb-8 animate-pulse">
        <div className="h-5 w-44 bg-ink/10 rounded mb-3" />
        <div className="h-4 w-72 bg-ink/10 rounded" />
      </section>
    )
  }

  if (isError) {
    return (
      <section className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 mb-8 text-sm text-red-300">
        Could not load notification alerts. Refresh the page to retry.
      </section>
    )
  }

  // Don't render the section at all when there's nothing to act on — keeps
  // the dashboard quiet on healthy days.
  if (alerts.length === 0) return null

  return (
    <section className="bg-plum-light border border-ink/10 rounded-lg p-6 mb-8">
      <header className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-5 h-5 text-amber-600" aria-hidden />
            <h2 className="font-serif text-xl text-ink">
              Notification Alerts ({alerts.length})
            </h2>
          </div>
          <p className="text-xs text-ink-soft">
            {data?.finalCount ?? 0} need action ·{' '}
            {data?.retryingCount ?? 0} still retrying ·{' '}
            <Link
              href="/admin/notification-alerts"
              className="underline underline-offset-2 hover:text-ink"
            >
              View history
            </Link>
          </p>
        </div>
      </header>

      <ul className="space-y-3">
        {alerts.map((a) => (
          <AlertRow
            key={a.id}
            alert={a}
            busy={busy === a.id}
            onAcknowledge={() => acknowledge(a.id)}
          />
        ))}
      </ul>
    </section>
  )
}

function AlertRow({
  alert,
  busy,
  onAcknowledge,
}: {
  alert: AlertApi
  busy: boolean
  onAcknowledge: () => void
}) {
  const dotClass = alert.isFinal
    ? 'bg-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.18)]'
    : 'bg-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,0.18)]'
  const channelIcon = channelIconFor(alert.channel)

  return (
    <li className="bg-paper border border-ink/8 rounded-lg p-4 flex items-start gap-3">
      <span
        aria-hidden
        className={`mt-1.5 inline-block w-2.5 h-2.5 rounded-full shrink-0 ${dotClass}`}
        title={alert.isFinal ? 'Final failure — needs action' : 'Still retrying'}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <span className="font-medium text-ink">Order #{alert.orderId}</span>
          <span className="text-ink-mute">·</span>
          <span className="text-ink-soft">{alert.customerName || 'Customer'}</span>
          <span className="text-ink-mute">·</span>
          <span className="text-ink-mute text-xs">{formatRelative(alert.lastFailureAt)}</span>
        </div>

        <div className="flex items-center gap-2 mt-1 text-xs text-ink-soft">
          {channelIcon}
          <span className="font-medium capitalize">{alert.channel}</span>
          <span className="text-ink-mute">·</span>
          <span>{humaniseOperation(alert.operation)}</span>
          <span className="text-ink-mute">·</span>
          <span>
            attempts: {alert.attempts}/{MAX_RETRIES_HINT}
            {alert.isFinal ? ' (final)' : ' (will retry)'}
          </span>
        </div>

        <p className="mt-2 text-sm text-ink/85 leading-snug break-words">
          {alert.reason}
        </p>

        <div className="mt-3 flex items-center gap-2">
          <Link
            href={`/admin/orders/detail?id=${encodeURIComponent(alert.orderId)}`}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-ink/15 text-xs font-medium text-ink hover:bg-lavender-pastel/10 transition-colors"
          >
            View Order
            <ArrowUpRight className="w-3.5 h-3.5" aria-hidden />
          </Link>
          <button
            type="button"
            onClick={onAcknowledge}
            disabled={busy}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-ink text-paper text-xs font-medium hover:bg-ink/90 disabled:opacity-50 transition-colors"
          >
            <Check className="w-3.5 h-3.5" aria-hidden />
            {busy ? 'Acknowledging…' : 'Acknowledge'}
          </button>
        </div>
      </div>
    </li>
  )
}

function channelIconFor(channel: AlertApi['channel']) {
  switch (channel) {
    case 'email':
      return <Mail className="w-3.5 h-3.5 text-ink-mute" aria-hidden />
    case 'whatsapp':
      return <MessageCircle className="w-3.5 h-3.5 text-ink-mute" aria-hidden />
    case 'payment':
      return <IndianRupee className="w-3.5 h-3.5 text-ink-mute" aria-hidden />
    case 'invoice':
      return <FileText className="w-3.5 h-3.5 text-ink-mute" aria-hidden />
  }
}

// Reverse the templateKey conventions used by the dispatcher.
function humaniseOperation(op: string): string {
  if (op === 'payment_after_cancel') return 'Payment captured after cancellation'
  if (op === 'invoice_generation') return 'Invoice generation'
  // Standard order_xxx templates → "Order xxx"
  if (op.startsWith('order_')) {
    return 'Order ' + op.slice(6).replace(/_/g, ' ')
  }
  if (op === 'review_request') return 'Review request'
  if (op === 'refund_processed') return 'Refund processed'
  return op
}

function formatRelative(iso: string): string {
  try {
    const t = new Date(iso).getTime()
    const diff = Date.now() - t
    if (diff < 60_000) return 'just now'
    if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)} min ago`
    if (diff < 24 * 60 * 60_000) return `${Math.floor(diff / (60 * 60_000))} hr ago`
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}
