'use client'

/**
 * /admin/notifications - sitewide notification activity + reporting.
 *
 * Two surfaces stacked on one page:
 *
 *   1. Stat cards (top): total / sent / failed / failure rate for the
 *      current date range, plus a per-template breakdown table for
 *      "which template fails most often?"
 *
 *   2. Activity feed (bottom): paginated, filterable list of every
 *      email + WhatsApp message we've sent. Filters: date range,
 *      channel, status, template, order, customer search.
 *
 * Data sources are the existing emailLog + whatsappMessages tables. No
 * new write paths - this is pure read-only operational visibility.
 */

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import {
  Mail,
  MessageCircle,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowUpRight,
  Search,
  RotateCw,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'

interface ActivityRow {
  id: string
  createdAt: string
  channel: 'email' | 'whatsapp'
  templateKey: string
  orderId: string
  status: 'sent' | 'failed' | 'unknown'
  recipientContact: string
  customerName: string
  attempt: number
  errorMessage?: string
  messageId?: string
}

interface ChannelBucket { sent: number; failed: number; total: number }
interface TemplateBucket { templateKey: string; sent: number; failed: number; failureRate: number }
interface StatsResponse {
  total: number
  sent: number
  failed: number
  // Attempt-level rate: failed attempts / total attempts. Queue retries
  // each count as a separate attempt - informational only, no threshold.
  attemptFailureRate: number
  // Notification-level metrics: how many distinct customer notifications
  // (orderId × channel × templateKey) fired in the window, and how many
  // of those reached the queue's final-failure state. This is the
  // operationally honest number - threshold colouring lives here.
  uniqueNotifications: number
  finalFailures: number
  notificationFailureRate: number
  byChannel: { email: ChannelBucket; whatsapp: ChannelBucket }
  byTemplate: TemplateBucket[]
  windowFrom?: string
  windowTo?: string
}
interface ActivityResponse {
  activity: ActivityRow[]
  total: number
  limit: number
}

type ChannelFilter = 'all' | 'email' | 'whatsapp'
type StatusFilter = 'all' | 'sent' | 'failed'
type RangePreset = '24h' | '7d' | '30d' | '90d' | 'custom'

function presetRange(p: RangePreset): { from: string; to: string } {
  const now = new Date()
  const to = now.toISOString()
  let from: Date
  switch (p) {
    case '24h':  from = new Date(now.getTime() - 24 * 60 * 60 * 1000); break
    case '7d':   from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break
    case '30d':  from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break
    case '90d':  from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); break
    default:     from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  }
  return { from: from.toISOString(), to }
}

export default function AdminNotificationsPage() {
  const [preset, setPreset] = useState<RangePreset>('7d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [channel, setChannel] = useState<ChannelFilter>('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [templateKey, setTemplateKey] = useState<string>('')
  const [orderId, setOrderId] = useState<string>('')
  const [customerSearch, setCustomerSearch] = useState<string>('')

  const range = useMemo(() => {
    if (preset === 'custom') return { from: customFrom, to: customTo }
    return presetRange(preset)
  }, [preset, customFrom, customTo])

  const queryParams = useMemo(() => {
    const p = new URLSearchParams()
    if (range.from) p.set('from', range.from)
    if (range.to) p.set('to', range.to)
    if (channel !== 'all') p.set('channel', channel)
    if (status !== 'all') p.set('status', status)
    if (templateKey.trim()) p.set('templateKey', templateKey.trim())
    if (orderId.trim()) p.set('orderId', orderId.trim())
    if (customerSearch.trim()) p.set('customerSearch', customerSearch.trim())
    p.set('limit', '100')
    return p.toString()
  }, [range, channel, status, templateKey, orderId, customerSearch])

  const statsParams = useMemo(() => {
    const p = new URLSearchParams()
    if (range.from) p.set('from', range.from)
    if (range.to) p.set('to', range.to)
    return p.toString()
  }, [range])

  const { data: stats, isLoading: statsLoading } = useQuery<StatsResponse>({
    queryKey: ['admin-notifications-stats', statsParams],
    queryFn: () => apiFetch<StatsResponse>(`/admin/notifications/stats?${statsParams}`),
    staleTime: 30_000,
  })

  const { data: activity, isLoading: activityLoading, refetch } = useQuery<ActivityResponse>({
    queryKey: ['admin-notifications-activity', queryParams],
    queryFn: () => apiFetch<ActivityResponse>(`/admin/notifications/activity?${queryParams}`),
    staleTime: 15_000,
  })

  const uniqueTemplates = useMemo(() => {
    const set = new Set<string>()
    for (const r of stats?.byTemplate || []) set.add(r.templateKey)
    return Array.from(set).sort()
  }, [stats])

  return (
    <div>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-ink mb-1">Notifications</h1>
          <p className="text-ink-soft text-sm">
            Every email and WhatsApp the studio has sent. Filter, audit, troubleshoot.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-ink/15 text-xs font-medium text-ink hover:bg-lavender-pastel/10 transition-colors"
        >
          <RotateCw className="w-3.5 h-3.5" aria-hidden />
          Refresh
        </button>
      </header>

      <StatCards stats={stats} loading={statsLoading} />

      <FilterBar
        preset={preset}
        setPreset={setPreset}
        customFrom={customFrom}
        setCustomFrom={setCustomFrom}
        customTo={customTo}
        setCustomTo={setCustomTo}
        channel={channel}
        setChannel={setChannel}
        status={status}
        setStatus={setStatus}
        templateKey={templateKey}
        setTemplateKey={setTemplateKey}
        templates={uniqueTemplates}
        orderId={orderId}
        setOrderId={setOrderId}
        customerSearch={customerSearch}
        setCustomerSearch={setCustomerSearch}
      />

      <TemplateBreakdown templates={stats?.byTemplate || []} loading={statsLoading} />

      <ActivityTable rows={activity?.activity || []} total={activity?.total ?? 0} loading={activityLoading} />
    </div>
  )
}

// ── Stat cards ──────────────────────────────────────────────────────
function StatCards({ stats, loading }: { stats?: StatsResponse; loading: boolean }) {
  const notifRate = stats?.notificationFailureRate ?? 0
  const cards = [
    { name: 'Total attempts', value: stats?.total ?? 0, color: 'text-ink', subtitle: undefined as string | undefined },
    { name: 'Successful', value: stats?.sent ?? 0, color: 'text-emerald-700', subtitle: undefined },
    { name: 'Failed', value: stats?.failed ?? 0, color: 'text-red-700', subtitle: undefined },
    {
      name: 'Notification failure rate',
      value: `${notifRate}%`,
      color: notifRate > 5 ? 'text-red-700' : 'text-ink',
      // The customer-impact metric - how many distinct notifications never
      // reached the customer, across the unique groups that fired in window.
      subtitle: stats
        ? `${stats.finalFailures} of ${stats.uniqueNotifications} notifications`
        : undefined,
    },
    {
      name: 'Attempt failure rate',
      value: `${stats?.attemptFailureRate ?? 0}%`,
      color: 'text-ink-soft',
      // Infrastructure health - retries count, so this can be non-zero
      // even when the customer ultimately received every notification.
      subtitle: 'Send infrastructure (retries count)',
    },
  ]
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
      {cards.map((c) => (
        <div key={c.name} className="bg-plum-light border border-ink/10 rounded-xl p-5">
          <p className="text-xs text-ink-soft mb-2">{c.name}</p>
          {loading ? (
            <div className="h-7 w-24 bg-ink/10 rounded animate-pulse" />
          ) : (
            <>
              <p className={`text-2xl font-serif ${c.color}`}>{c.value}</p>
              {c.subtitle && (
                <p className="text-[10px] uppercase tracking-wider text-ink-mute mt-1.5">{c.subtitle}</p>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Filter bar ──────────────────────────────────────────────────────
function FilterBar(props: {
  preset: RangePreset
  setPreset: (v: RangePreset) => void
  customFrom: string
  setCustomFrom: (v: string) => void
  customTo: string
  setCustomTo: (v: string) => void
  channel: ChannelFilter
  setChannel: (v: ChannelFilter) => void
  status: StatusFilter
  setStatus: (v: StatusFilter) => void
  templateKey: string
  setTemplateKey: (v: string) => void
  templates: string[]
  orderId: string
  setOrderId: (v: string) => void
  customerSearch: string
  setCustomerSearch: (v: string) => void
}) {
  return (
    <div className="bg-plum-light border border-ink/10 rounded-xl p-4 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <Field label="Range">
          <select
            value={props.preset}
            onChange={(e) => props.setPreset(e.target.value as RangePreset)}
            className="w-full h-9 px-3 rounded-lg border border-ink/15 bg-paper text-sm text-ink"
          >
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="custom">Custom range</option>
          </select>
        </Field>
        {props.preset === 'custom' && (
          <>
            <Field label="From">
              <input
                type="datetime-local"
                value={props.customFrom.slice(0, 16)}
                onChange={(e) => props.setCustomFrom(e.target.value ? new Date(e.target.value).toISOString() : '')}
                className="w-full h-9 px-3 rounded-lg border border-ink/15 bg-paper text-sm text-ink"
              />
            </Field>
            <Field label="To">
              <input
                type="datetime-local"
                value={props.customTo.slice(0, 16)}
                onChange={(e) => props.setCustomTo(e.target.value ? new Date(e.target.value).toISOString() : '')}
                className="w-full h-9 px-3 rounded-lg border border-ink/15 bg-paper text-sm text-ink"
              />
            </Field>
          </>
        )}
        <Field label="Channel">
          <select
            value={props.channel}
            onChange={(e) => props.setChannel(e.target.value as ChannelFilter)}
            className="w-full h-9 px-3 rounded-lg border border-ink/15 bg-paper text-sm text-ink"
          >
            <option value="all">All</option>
            <option value="email">Email</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
        </Field>
        <Field label="Status">
          <select
            value={props.status}
            onChange={(e) => props.setStatus(e.target.value as StatusFilter)}
            className="w-full h-9 px-3 rounded-lg border border-ink/15 bg-paper text-sm text-ink"
          >
            <option value="all">All</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
          </select>
        </Field>
        <Field label="Template">
          <select
            value={props.templateKey}
            onChange={(e) => props.setTemplateKey(e.target.value)}
            className="w-full h-9 px-3 rounded-lg border border-ink/15 bg-paper text-sm text-ink"
          >
            <option value="">All templates</option>
            {props.templates.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Order #">
          <input
            type="text"
            value={props.orderId}
            onChange={(e) => props.setOrderId(e.target.value)}
            placeholder="20260611120342"
            className="w-full h-9 px-3 rounded-lg border border-ink/15 bg-paper text-sm text-ink placeholder:text-ink-mute"
          />
        </Field>
        <Field label="Customer / contact">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-mute" aria-hidden />
            <input
              type="text"
              value={props.customerSearch}
              onChange={(e) => props.setCustomerSearch(e.target.value)}
              placeholder="Name, email, phone"
              className="w-full h-9 pl-8 pr-3 rounded-lg border border-ink/15 bg-paper text-sm text-ink placeholder:text-ink-mute"
            />
          </div>
        </Field>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wider text-ink-mute mb-1">{label}</span>
      {children}
    </label>
  )
}

// ── Template breakdown ─────────────────────────────────────────────
function TemplateBreakdown({ templates, loading }: { templates: TemplateBucket[]; loading: boolean }) {
  if (loading) return null
  if (templates.length === 0) return null
  return (
    <div className="bg-plum-light border border-ink/10 rounded-xl p-5 mb-6">
      <h2 className="font-serif text-lg text-ink mb-3">By template</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-ink-mute">
              <th className="py-2 pr-3 font-medium">Template</th>
              <th className="py-2 pr-3 font-medium text-right">Sent</th>
              <th className="py-2 pr-3 font-medium text-right">Failed</th>
              <th className="py-2 font-medium text-right">Failure rate</th>
            </tr>
          </thead>
          <tbody>
            {templates.slice(0, 12).map((t) => (
              <tr key={t.templateKey} className="border-t border-ink/5">
                <td className="py-2 pr-3 text-ink">{t.templateKey || '(unknown)'}</td>
                <td className="py-2 pr-3 text-right text-emerald-700 tabular-nums">{t.sent}</td>
                <td className="py-2 pr-3 text-right tabular-nums" style={{ color: t.failed > 0 ? 'rgb(185 28 28)' : 'rgb(138 126 110)' }}>{t.failed}</td>
                <td className="py-2 text-right tabular-nums" style={{ color: t.failureRate > 5 ? 'rgb(185 28 28)' : 'rgb(138 126 110)' }}>{t.failureRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Activity table ──────────────────────────────────────────────────
function ActivityTable({ rows, total, loading }: { rows: ActivityRow[]; total: number; loading: boolean }) {
  return (
    <div className="bg-plum-light border border-ink/10 rounded-xl p-5">
      <h2 className="font-serif text-lg text-ink mb-1">Activity</h2>
      <p className="text-xs text-ink-soft mb-4">
        {loading ? 'Loading…' : `${rows.length} of ${total} matching records`}
      </p>
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 rounded-lg bg-ink/5 animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-ink-soft">
          <p>No notifications match the current filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-ink-mute">
                <th className="py-2 pr-3 font-medium">When</th>
                <th className="py-2 pr-3 font-medium">Channel</th>
                <th className="py-2 pr-3 font-medium">Template</th>
                <th className="py-2 pr-3 font-medium">Order #</th>
                <th className="py-2 pr-3 font-medium">Customer</th>
                <th className="py-2 pr-3 font-medium">Recipient</th>
                <th className="py-2 pr-3 font-medium text-center">Status</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <ActivityRowItem key={r.id} row={r} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ActivityRowItem({ row }: { row: ActivityRow }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <tr className="border-t border-ink/5 hover:bg-paper/40 cursor-pointer" onClick={() => setOpen((o) => !o)}>
        <td className="py-2 pr-3 text-ink-soft whitespace-nowrap">{formatTimestamp(row.createdAt)}</td>
        <td className="py-2 pr-3">
          {row.channel === 'email' ? (
            <span className="inline-flex items-center gap-1 text-ink-soft"><Mail className="w-3.5 h-3.5" aria-hidden /> Email</span>
          ) : (
            <span className="inline-flex items-center gap-1 text-ink-soft"><MessageCircle className="w-3.5 h-3.5" aria-hidden /> WhatsApp</span>
          )}
        </td>
        <td className="py-2 pr-3 text-ink">{row.templateKey || '(unknown)'}</td>
        <td className="py-2 pr-3 text-ink font-mono text-xs">{row.orderId}</td>
        <td className="py-2 pr-3 text-ink-soft">{row.customerName || '-'}</td>
        <td className="py-2 pr-3 text-ink-soft">{row.recipientContact || '-'}</td>
        <td className="py-2 pr-3 text-center">
          <StatusBadge status={row.status} />
        </td>
        <td className="py-2">
          <Link
            href={`/admin/orders/detail?id=${encodeURIComponent(row.orderId)}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-xs text-ink-soft hover:text-ink"
          >
            View
            <ArrowUpRight className="w-3 h-3" aria-hidden />
          </Link>
        </td>
      </tr>
      {open && (
        <tr className="border-t border-ink/5 bg-paper/30">
          <td colSpan={8} className="py-3 px-4 text-xs text-ink-soft">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5">
              {row.attempt > 1 && (
                <div className="flex gap-2"><dt className="text-ink-mute">Attempt</dt><dd className="text-ink">{row.attempt}</dd></div>
              )}
              {row.messageId && (
                <div className="flex gap-2"><dt className="text-ink-mute">Message ID</dt><dd className="text-ink font-mono">{row.messageId}</dd></div>
              )}
              {row.errorMessage && (
                <div className="flex gap-2 col-span-2"><dt className="text-ink-mute shrink-0">Error</dt><dd className="text-red-700">{row.errorMessage}</dd></div>
              )}
              {!row.errorMessage && row.status === 'sent' && (
                <div className="flex gap-2 col-span-2"><dt className="text-ink-mute">Outcome</dt><dd className="text-emerald-700">Delivered to provider</dd></div>
              )}
            </dl>
          </td>
        </tr>
      )}
    </>
  )
}

function StatusBadge({ status }: { status: ActivityRow['status'] }) {
  if (status === 'sent') {
    return <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 className="w-3.5 h-3.5" aria-hidden />Sent</span>
  }
  if (status === 'failed') {
    return <span className="inline-flex items-center gap-1 text-xs text-red-700"><XCircle className="w-3.5 h-3.5" aria-hidden />Failed</span>
  }
  return <span className="inline-flex items-center gap-1 text-xs text-ink-mute"><AlertCircle className="w-3.5 h-3.5" aria-hidden />Unknown</span>
}

function formatTimestamp(iso: string): string {
  if (!iso) return '-'
  try {
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
