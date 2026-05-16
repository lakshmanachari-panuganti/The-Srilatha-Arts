import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import {
  listAnnouncements,
  getAnnouncement,
  upsertAnnouncement,
  deleteAnnouncement,
  Row,
} from '../services/tableStorage'
import { jsonResponse, errorResponse, corsPreflightResponse, noContent } from '../utils/response'
import { requireAdmin } from '../middleware/adminGuard'
import { enforceCsrf } from '../middleware/csrfGuard'
import { randomUUID } from 'crypto'

interface AnnouncementInput {
  message?: string
  href?: string
  link?: string
  startDate?: string
  endDate?: string
  priority?: number
  theme?: 'gold' | 'festive-pink' | 'muted'
  active?: boolean
  linkedCouponCode?: string
}

function toApi(row: Row) {
  return {
    id: row.rowKey,
    message: row.message,
    href: row.href || row.link || '/',
    startDate: row.startDate || undefined,
    endDate: row.endDate || undefined,
    priority: Number(row.priority ?? 99),
    theme: row.theme || 'gold',
    active: row.active !== false,
    linkedCouponCode: row.linkedCouponCode || undefined,
  }
}

function fromInput(id: string, input: AnnouncementInput, existing?: Row): Row {
  return {
    partitionKey: 'banner',
    rowKey: id,
    message: input.message ?? existing?.message ?? '',
    href: input.href ?? input.link ?? existing?.href ?? '/',
    startDate: input.startDate ?? existing?.startDate ?? '',
    endDate: input.endDate ?? existing?.endDate ?? '',
    priority: input.priority ?? existing?.priority ?? 99,
    theme: input.theme ?? existing?.theme ?? 'gold',
    active: input.active ?? existing?.active ?? true,
    linkedCouponCode: input.linkedCouponCode ?? existing?.linkedCouponCode ?? '',
    updatedAt: new Date().toISOString(),
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  }
}

// PUBLIC: GET /api/announcements
export async function getPublicAnnouncements(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)

  try {
    const rows = await listAnnouncements(false)
    return jsonResponse(
      { announcements: rows.map(toApi) },
      200,
      { 'Cache-Control': 'public, max-age=60, s-maxage=60' },
      origin,
    )
  } catch (err) {
    context.error('listAnnouncements failed', err)
    return errorResponse('Failed to load announcements', 500, origin)
  }
}

// ADMIN: GET, POST /api/admin/announcements
export async function adminAnnouncements(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)
  const csrfFail = enforceCsrf(request, origin)
  if (csrfFail) return csrfFail

  const admin = requireAdmin(request)
  if (!admin) return errorResponse('Unauthorized', 401, origin)

  try {
    if (request.method === 'GET') {
      const rows = await listAnnouncements(true)
      return jsonResponse({ announcements: rows.map(toApi) }, 200, {}, origin)
    }

    if (request.method === 'POST') {
      const body = (await request.json()) as AnnouncementInput
      if (!body.message || body.message.length > 200) {
        return errorResponse('Message is required (≤ 200 chars)', 400, origin)
      }
      const id = randomUUID()
      const row = fromInput(id, body)
      await upsertAnnouncement(row)
      return jsonResponse({ announcement: toApi(row) }, 201, {}, origin)
    }

    return errorResponse('Method not allowed', 405, origin)
  } catch (err) {
    context.error('adminAnnouncements failed', err)
    return errorResponse('Internal error', 500, origin)
  }
}

// ADMIN: GET, PATCH, DELETE /api/admin/announcements/{id}
export async function adminAnnouncementById(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)
  const csrfFail = enforceCsrf(request, origin)
  if (csrfFail) return csrfFail

  const admin = requireAdmin(request)
  if (!admin) return errorResponse('Unauthorized', 401, origin)

  const id = request.params.id
  if (!id) return errorResponse('Missing announcement id', 400, origin)

  try {
    const existing = await getAnnouncement(id)

    if (request.method === 'GET') {
      if (!existing) return errorResponse('Not found', 404, origin)
      return jsonResponse({ announcement: toApi(existing) }, 200, {}, origin)
    }

    if (request.method === 'PATCH') {
      if (!existing) return errorResponse('Not found', 404, origin)
      const body = (await request.json()) as AnnouncementInput
      const row = fromInput(id, body, existing)
      await upsertAnnouncement(row)
      return jsonResponse({ announcement: toApi(row) }, 200, {}, origin)
    }

    if (request.method === 'DELETE') {
      if (!existing) return noContent(origin)
      await deleteAnnouncement(id)
      return noContent(origin)
    }

    return errorResponse('Method not allowed', 405, origin)
  } catch (err) {
    context.error('adminAnnouncementById failed', err)
    return errorResponse('Internal error', 500, origin)
  }
}

app.http('getPublicAnnouncements', {
  methods: ['GET', 'OPTIONS'],
  route: 'api/announcements',
  authLevel: 'anonymous',
  handler: getPublicAnnouncements,
})

app.http('adminAnnouncements', {
  methods: ['GET', 'POST', 'OPTIONS'],
  route: 'api/admin/announcements',
  authLevel: 'anonymous',
  handler: adminAnnouncements,
})

app.http('adminAnnouncementById', {
  methods: ['GET', 'PATCH', 'DELETE', 'OPTIONS'],
  route: 'api/admin/announcements/{id}',
  authLevel: 'anonymous',
  handler: adminAnnouncementById,
})
