/**
 * Admin notifications activity + stats endpoints.
 *
 *   GET /api/admin/notifications/activity   Sitewide notification feed
 *                                           (emailLog + whatsappMessages
 *                                           merged, paginated, filtered)
 *
 *   GET /api/admin/notifications/stats      Aggregate counts for the
 *                                           dashboard cards (today / this
 *                                           week / this month / failure rate)
 *
 * Activity rows are *unified* — each one is `{ channel, templateKey,
 * orderId, status, recipientContact, customerName, attempt, errorMessage,
 * messageId, createdAt }`. Customer name is enriched at read time from a
 * per-page orders cache to avoid N+1 lookups.
 *
 * Filters: from / to (ISO date), channel (email|whatsapp|all), status
 * (sent|failed|all), templateKey, orderId, customerSearch (substring
 * match across name / email / phone). Server-side date + channel +
 * orderId filters are pushed to the table query; the rest run after
 * fetch (cheaper for the volume we expect and keeps the read footprint
 * simple).
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { requireAdmin } from '../middleware/adminGuard'
import { jsonResponse, errorResponse, corsPreflightResponse } from '../utils/response'
import {
  listAllEmailLogs,
  listAllWhatsAppMessages,
  getOrderById,
  Row,
} from '../services/tableStorage'

interface ActivityRow {
  id: string                  // stable per-row id for client keys
  createdAt: string
  channel: 'email' | 'whatsapp'
  templateKey: string
  orderId: string
  status: 'sent' | 'failed' | 'unknown'
  recipientContact: string    // email address or phone
  customerName: string
  attempt: number
  errorMessage?: string
  messageId?: string
}

function emailRowToActivity(r: Row): ActivityRow {
  const status: ActivityRow['status'] =
    r.status === 'sent' ? 'sent' : r.status === 'failed' ? 'failed' : 'unknown'
  return {
    id: `email__${r.partitionKey}__${r.rowKey}`,
    createdAt: String(r.createdAt || ''),
    channel: 'email',
    templateKey: String(r.templateKey || ''),
    orderId: String(r.partitionKey || r.orderId || ''),
    status,
    recipientContact: String(r.to || ''),
    customerName: '',
    attempt: Number(r.attempt ?? 1),
    errorMessage: r.error ? String(r.error) : undefined,
    messageId: r.messageId ? String(r.messageId) : undefined,
  }
}

function whatsappRowToActivity(r: Row): ActivityRow {
  // Outbound rows have status='sent' on success; inbound rows are filtered
  // out below (we only show outbound — what we send to customers).
  const status: ActivityRow['status'] =
    r.status === 'sent' ? 'sent'
      : r.status === 'failed' ? 'failed'
      : 'unknown'
  return {
    id: `wa__${r.partitionKey}__${r.rowKey}`,
    createdAt: String(r.createdAt || ''),
    channel: 'whatsapp',
    templateKey: String(r.templateName || ''),
    orderId: String(r.orderId || ''),
    status,
    recipientContact: String(r.partitionKey || ''),
    customerName: '',
    attempt: 1,                 // WhatsApp queue retries log a new row per attempt
    errorMessage: r.statusError ? String(r.statusError) : undefined,
    messageId: r.waMessageId ? String(r.waMessageId) : undefined,
  }
}

// Per-page order-cache. Reads up to ~50 unique orders to enrich rows
// with customer name. Bounded by page size, never grows beyond that.
async function enrichWithCustomerNames(rows: ActivityRow[]): Promise<void> {
  const uniqueOrderIds = Array.from(new Set(rows.map((r) => r.orderId).filter(Boolean)))
  const orderCache = new Map<string, Row>()
  await Promise.all(
    uniqueOrderIds.map(async (id) => {
      try {
        const o = await getOrderById(id)
        if (o) orderCache.set(id, o)
      } catch {
        // best-effort enrichment — silently skip on lookup failure
      }
    }),
  )
  for (const r of rows) {
    const o = orderCache.get(r.orderId)
    if (o) r.customerName = String(o.customerName || '')
  }
}

interface ActivityFilters {
  channel: 'email' | 'whatsapp' | 'all'
  status: 'sent' | 'failed' | 'all'
  templateKey?: string
  orderId?: string
  customerSearch?: string
  from?: string
  to?: string
}

function parseFilters(request: HttpRequest): ActivityFilters {
  const channelRaw = request.query.get('channel')
  const statusRaw = request.query.get('status')
  return {
    channel:
      channelRaw === 'email' || channelRaw === 'whatsapp' ? channelRaw : 'all',
    status:
      statusRaw === 'sent' || statusRaw === 'failed' ? statusRaw : 'all',
    templateKey: request.query.get('templateKey') || undefined,
    orderId: request.query.get('orderId') || undefined,
    customerSearch: (request.query.get('customerSearch') || '').trim() || undefined,
    from: request.query.get('from') || undefined,
    to: request.query.get('to') || undefined,
  }
}

function applyPostFilters(
  rows: ActivityRow[],
  filters: ActivityFilters,
): ActivityRow[] {
  return rows.filter((r) => {
    if (filters.status !== 'all' && r.status !== filters.status) return false
    if (filters.templateKey && r.templateKey !== filters.templateKey) return false
    if (filters.orderId && r.orderId !== filters.orderId) return false
    if (filters.customerSearch) {
      const needle = filters.customerSearch.toLowerCase()
      const hay = `${r.customerName} ${r.recipientContact} ${r.orderId}`.toLowerCase()
      if (!hay.includes(needle)) return false
    }
    return true
  })
}

// ─── GET /api/admin/notifications/activity ────────────────────────

async function listActivity(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)

  const admin = requireAdmin(request)
  if (!admin) return errorResponse('Unauthorized', 401, origin)

  try {
    const filters = parseFilters(request)
    const limit = Math.min(
      Math.max(1, parseInt(request.query.get('limit') || '50', 10) || 50),
      200,
    )

    // Server-side fetches. Date range pushed down so cold scans of giant
    // tables stay bounded as volume grows.
    const fetchEmail = filters.channel === 'whatsapp'
      ? Promise.resolve<Row[]>([])
      : listAllEmailLogs(filters.from, filters.to)
    const fetchWA = filters.channel === 'email'
      ? Promise.resolve<Row[]>([])
      : listAllWhatsAppMessages(filters.from, filters.to)
    const [emailRows, waRows] = await Promise.all([fetchEmail, fetchWA])

    // Convert WhatsApp inbound rows are filtered out — we want what we sent.
    const waOutbound = waRows.filter((r) => r.direction === 'outbound')

    const merged: ActivityRow[] = [
      ...emailRows.map(emailRowToActivity),
      ...waOutbound.map(whatsappRowToActivity),
    ]
    merged.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

    const filtered = applyPostFilters(merged, filters)
    const page = filtered.slice(0, limit)

    await enrichWithCustomerNames(page)

    return jsonResponse(
      {
        activity: page,
        total: filtered.length,
        limit,
      },
      200,
      { 'Cache-Control': 'no-store' },
      origin,
    )
  } catch (err) {
    context.error('listActivity failed', err)
    return errorResponse('Failed to load notification activity', 500, origin)
  }
}

// ─── GET /api/admin/notifications/stats ───────────────────────────

interface ChannelBucket { sent: number; failed: number; total: number }
interface TemplateBucket { templateKey: string; sent: number; failed: number; failureRate: number }

async function activityStats(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)

  const admin = requireAdmin(request)
  if (!admin) return errorResponse('Unauthorized', 401, origin)

  try {
    const from = request.query.get('from') || undefined
    const to = request.query.get('to') || undefined

    const [emailRows, waRows] = await Promise.all([
      listAllEmailLogs(from, to),
      listAllWhatsAppMessages(from, to),
    ])

    const waOutbound = waRows.filter((r) => r.direction === 'outbound')

    const total = emailRows.length + waOutbound.length
    const email: ChannelBucket = {
      sent: emailRows.filter((r) => r.status === 'sent').length,
      failed: emailRows.filter((r) => r.status === 'failed').length,
      total: emailRows.length,
    }
    const whatsapp: ChannelBucket = {
      sent: waOutbound.filter((r) => r.status === 'sent').length,
      failed: waOutbound.filter((r) => r.status === 'failed').length,
      total: waOutbound.length,
    }
    const failed = email.failed + whatsapp.failed
    const sent = email.sent + whatsapp.sent
    const failureRate = total > 0 ? Math.round((failed / total) * 10000) / 100 : 0

    // Per-template breakdown — useful for "which template fails most often?"
    const templateMap = new Map<string, { sent: number; failed: number }>()
    const bump = (key: string, status: string) => {
      const bucket = templateMap.get(key) || { sent: 0, failed: 0 }
      if (status === 'sent') bucket.sent++
      else if (status === 'failed') bucket.failed++
      templateMap.set(key, bucket)
    }
    for (const r of emailRows) bump(String(r.templateKey || 'unknown'), String(r.status || ''))
    for (const r of waOutbound) bump(String(r.templateName || 'unknown'), String(r.status || ''))

    const byTemplate: TemplateBucket[] = Array.from(templateMap.entries())
      .map(([key, v]) => {
        const t = v.sent + v.failed
        return {
          templateKey: key,
          sent: v.sent,
          failed: v.failed,
          failureRate: t > 0 ? Math.round((v.failed / t) * 10000) / 100 : 0,
        }
      })
      .sort((a, b) => b.failed - a.failed || b.sent - a.sent)

    return jsonResponse(
      {
        total,
        sent,
        failed,
        failureRate,
        byChannel: { email, whatsapp },
        byTemplate,
        windowFrom: from,
        windowTo: to,
      },
      200,
      { 'Cache-Control': 'no-store' },
      origin,
    )
  } catch (err) {
    context.error('activityStats failed', err)
    return errorResponse('Failed to load notification stats', 500, origin)
  }
}

// ─── Route registrations ──────────────────────────────────────────

app.http('listNotificationActivity', {
  methods: ['GET', 'OPTIONS'],
  route: 'api/admin/notifications/activity',
  authLevel: 'anonymous',
  handler: listActivity,
})

app.http('notificationActivityStats', {
  methods: ['GET', 'OPTIONS'],
  route: 'api/admin/notifications/stats',
  authLevel: 'anonymous',
  handler: activityStats,
})
