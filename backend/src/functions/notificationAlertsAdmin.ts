/**
 * Admin notification-alerts endpoints.
 *
 *   GET   /api/admin/notification-alerts            list open alerts
 *   GET   /api/admin/notification-alerts/history    full audit history
 *   PATCH /api/admin/notification-alerts/{rowKey}   acknowledge an alert
 *
 * Authz: every endpoint gated by requireAdmin. Acknowledge writes go
 * through enforceCsrf since they're state-changing.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { requireAdmin } from '../middleware/adminGuard'
import { enforceCsrf } from '../middleware/csrfGuard'
import { jsonResponse, errorResponse, corsPreflightResponse } from '../utils/response'
import {
  listAlerts,
  acknowledgeAlert,
  type AlertChannel,
  type NotificationAlert,
} from '../services/notificationAlerts'

function toApi(alert: NotificationAlert) {
  return {
    id: alert.rowKey,
    orderId: alert.orderId,
    channel: alert.channel,
    operation: alert.operation,
    customerName: alert.customerName,
    customerContact: alert.customerContact,
    reason: alert.reason,
    attempts: alert.attempts,
    isFinal: alert.isFinal,
    status: alert.status,
    firstFailureAt: alert.firstFailureAt,
    lastFailureAt: alert.lastFailureAt,
    acknowledgedAt: alert.acknowledgedAt,
    acknowledgedBy: alert.acknowledgedBy,
    createdAt: alert.createdAt,
    updatedAt: alert.updatedAt,
  }
}

function parseChannel(raw: string | null): AlertChannel | undefined {
  if (!raw) return undefined
  if (raw === 'email' || raw === 'whatsapp' || raw === 'payment' || raw === 'invoice') {
    return raw
  }
  return undefined
}

// ─── GET /api/admin/notification-alerts ─────────────────────

async function listOpenAlerts(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)

  const admin = requireAdmin(request)
  if (!admin) return errorResponse('Unauthorized', 401, origin)

  try {
    const channel = parseChannel(request.query.get('channel'))
    const orderId = request.query.get('orderId') || undefined
    const limit = Math.min(
      Math.max(1, parseInt(request.query.get('limit') || '50', 10) || 50),
      200,
    )

    const alerts = await listAlerts({
      includeAcknowledged: false,
      channel,
      orderId,
      limit,
    })

    // Bucket counts for dashboard summary - admin sees "2 final, 3 retrying"
    // at the top of the section without iterating the array client-side.
    const finalCount = alerts.filter((a) => a.isFinal).length
    const retryingCount = alerts.length - finalCount

    return jsonResponse(
      {
        alerts: alerts.map(toApi),
        total: alerts.length,
        finalCount,
        retryingCount,
      },
      200,
      { 'Cache-Control': 'no-store' },
      origin,
    )
  } catch (err) {
    context.error('listOpenAlerts failed', err)
    return errorResponse('Failed to load notification alerts', 500, origin)
  }
}

// ─── GET /api/admin/notification-alerts/history ─────────────

async function alertsHistory(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)

  const admin = requireAdmin(request)
  if (!admin) return errorResponse('Unauthorized', 401, origin)

  try {
    const channel = parseChannel(request.query.get('channel'))
    const orderId = request.query.get('orderId') || undefined
    const limit = Math.min(
      Math.max(1, parseInt(request.query.get('limit') || '200', 10) || 200),
      1000,
    )

    const alerts = await listAlerts({
      includeAcknowledged: true,
      channel,
      orderId,
      limit,
    })

    return jsonResponse({ alerts: alerts.map(toApi), total: alerts.length }, 200, {}, origin)
  } catch (err) {
    context.error('alertsHistory failed', err)
    return errorResponse('Failed to load alert history', 500, origin)
  }
}

// ─── PATCH /api/admin/notification-alerts/{rowKey} ──────────

async function acknowledgeAlertHandler(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)
  const csrfFail = enforceCsrf(request, origin)
  if (csrfFail) return csrfFail

  const admin = requireAdmin(request)
  if (!admin) return errorResponse('Unauthorized', 401, origin)

  const rowKey = request.params.rowKey
  if (!rowKey) return errorResponse('Missing alert id', 400, origin)

  try {
    const body = (await request.json().catch(() => ({}))) as {
      status?: 'acknowledged'
    }
    if (body.status && body.status !== 'acknowledged') {
      return errorResponse('Only status: acknowledged is supported', 400, origin)
    }

    const updated = await acknowledgeAlert(rowKey, admin.adminId)
    if (!updated) return errorResponse('Alert not found', 404, origin)
    return jsonResponse({ alert: toApi(updated) }, 200, {}, origin)
  } catch (err) {
    context.error('acknowledgeAlert failed', err)
    return errorResponse('Failed to acknowledge alert', 500, origin)
  }
}

// ─── Route registrations ────────────────────────────────────

app.http('listOpenNotificationAlerts', {
  methods: ['GET', 'OPTIONS'],
  route: 'api/admin/notification-alerts',
  authLevel: 'anonymous',
  handler: listOpenAlerts,
})

app.http('notificationAlertsHistory', {
  methods: ['GET', 'OPTIONS'],
  route: 'api/admin/notification-alerts/history',
  authLevel: 'anonymous',
  handler: alertsHistory,
})

app.http('acknowledgeNotificationAlert', {
  methods: ['PATCH', 'OPTIONS'],
  route: 'api/admin/notification-alerts/{rowKey}',
  authLevel: 'anonymous',
  handler: acknowledgeAlertHandler,
})
