/**
 * Custom Order Inquiry Endpoints (§4.2, §5.2).
 *
 * POST  /api/custom-orders          - public submission (rate-limited)
 * GET   /api/admin/custom-orders    - admin Kanban listing
 * PATCH /api/admin/custom-orders/{id} - update status/quote
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import {
  createCustomOrder,
  listCustomOrders,
  getCustomOrder,
  updateCustomOrder,
  getUser,
  Row,
} from '../services/tableStorage'
import { requireAdmin } from '../middleware/adminGuard'
import { requireUser } from '../middleware/userGuard'
import { enforceCsrf } from '../middleware/csrfGuard'
import { jsonResponse, errorResponse, corsPreflightResponse } from '../utils/response'
import { checkAndIncrement } from '../services/rateLimit'
import { notifyStudioAdmins } from '../services/adminNotifications'
import { randomUUID } from 'crypto'
import { TableClient } from '@azure/data-tables'
import { DefaultAzureCredential } from '@azure/identity'
import type { CustomOrderStatus } from '../types'

// Reuse a single TableClient for cross-partition deletes of obsolete rows
// when a custom order moves between status partitions.
const customOrdersTableClient = (() => {
  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME
  if (!accountName) return null
  return new TableClient(
    `https://${accountName}.table.core.windows.net`,
    'customOrders',
    new DefaultAzureCredential(),
  )
})()

// Art forms supported by the business (used for validation). Must stay
// in sync with the frontend select on /custom-order. `wedding` was added
// on 2026-05-31 - the brand sells wedding decoratives, and routing those
// inquiries through "other" lost the categorisation.
const VALID_ART_FORMS = ['resin', 'dot-mandala', 'lippan', 'pichwai', 'kolam', 'wedding', 'other']

function getClientIp(request: HttpRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}

function toApi(row: Row) {
  return {
    id: row.inquiryId,
    status: row.status,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    customerPhone: row.customerPhone,
    artForm: row.artForm,
    size: row.size || undefined,
    palette: row.palette || undefined,
    description: row.description,
    referenceImages: safeJson(row.referenceImages) || [],
    budget: row.budget || undefined,
    quotedAmount: row.quotedAmount || undefined,
    adminNote: row.adminNote || undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function safeJson(val: unknown): unknown {
  if (!val) return undefined
  if (typeof val === 'object') return val
  try { return JSON.parse(String(val)) } catch { return val }
}

// ─── POST /api/custom-orders ─────────────────────────────────

async function submitCustomOrder(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)
  const csrfFail = enforceCsrf(request, origin)
  if (csrfFail) return csrfFail

  // Auth gate. Custom-order requests are contact-intent inquiries — we need a
  // durable way to reach the customer back, which is the profile's job.
  const authed = requireUser(request)
  if (!authed) {
    return errorResponse(
      'Please sign in to submit a custom order request.',
      401,
      origin,
    )
  }

  // Profile gate. The customer's stored name + phone are the values studio
  // staff will actually use to follow up, so both must be present before we
  // accept the request. Enforced server-side (independent of the form body)
  // so an incomplete-profile user cannot bypass by typing values into the
  // frontend.
  const profile = await getUser(authed.userId)
  if (!profile || profile.isActive === false) {
    return errorResponse('User account not found. Please sign in again.', 401, origin)
  }
  const profileName = typeof profile.name === 'string' ? profile.name.trim() : ''
  const profilePhone = typeof profile.phone === 'string' ? profile.phone.trim() : ''
  if (!profileName || !profilePhone) {
    // Use jsonResponse directly so we can attach a machine-readable code —
    // the frontend keys off `PROFILE_INCOMPLETE` to show the account CTA
    // without pattern-matching on the message text.
    return jsonResponse(
      {
        error: 'Please update your profile with your name and mobile number before submitting a custom order request.',
        code: 'PROFILE_INCOMPLETE',
      },
      400,
      {},
      origin,
    )
  }

  // Rate limit: 3/hour/IP
  const ip = getClientIp(request)
  const rateCheck = await checkAndIncrement(`custom_order:${ip}`, 3, 3600_000)
  if (!rateCheck.allowed) {
    return errorResponse('Too many submissions. Please try again later.', 429, origin)
  }

  try {
    const body = (await request.json()) as {
      customerName?: string
      customerEmail?: string
      customerPhone?: string
      artForm?: string
      size?: string
      palette?: string
      description?: string
      referenceImages?: string[]
      budget?: string
    }

    if (!body.artForm) return errorResponse('Art form is required', 400, origin)
    if (!body.description) return errorResponse('Description is required', 400, origin)

    // Name / phone come from the trusted profile - the body values (if any)
    // are ignored so admins always see the same identity that appears on
    // the customer's account.
    const customerName = profileName
    const customerPhone = profilePhone
    const customerEmail = authed.userId
    const description = body.description.trim()

    if (description.length > 2000) {
      return errorResponse('Description must be 2000 characters or less', 400, origin)
    }
    if (!VALID_ART_FORMS.includes(body.artForm.toLowerCase())) {
      return errorResponse(`Art form must be one of: ${VALID_ART_FORMS.join(', ')}`, 400, origin)
    }
    if (body.size && body.size.length > 50) {
      return errorResponse('Size must be 50 characters or less', 400, origin)
    }
    if (body.palette && body.palette.length > 100) {
      return errorResponse('Palette must be 100 characters or less', 400, origin)
    }

    const inquiryId = randomUUID().slice(0, 12)
    const now = new Date().toISOString()

    const row: Row = {
      partitionKey: 'inbox',
      rowKey: `NEW_${inquiryId}`,
      inquiryId,
      status: 'NEW',
      customerName,
      customerEmail: customerEmail.toLowerCase(),
      customerPhone,
      artForm: body.artForm.toLowerCase(),
      size: body.size || '',
      palette: body.palette || '',
      description,
      referenceImages: body.referenceImages ? JSON.stringify(body.referenceImages) : '[]',
      budget: body.budget || '',
      createdAt: now,
      updatedAt: now,
    }

    await createCustomOrder(row)

    // Fan out a WhatsApp notification to every configured studio admin.
    // notifyStudioAdmins never throws - per-admin errors are isolated and
    // logged, an empty / unconfigured admin list is a warn-and-continue.
    try {
      const fanout = await notifyStudioAdmins({
        customerName,
        customerPhone,
        context,
      })
      context.log(
        `submitCustomOrder: studio-admin fan-out for ${inquiryId} — attempted=${fanout.attempted} succeeded=${fanout.succeeded} failed=${fanout.failed} skipped=${fanout.skipped}`,
      )
    } catch (notifyErr) {
      // Defensive: notifyStudioAdmins is documented as non-throwing, but if
      // that contract is ever broken we still don't want to fail the submit.
      context.warn(
        `submitCustomOrder: unexpected fan-out error for ${inquiryId} (non-fatal): ${String(notifyErr)}`,
      )
    }

    return jsonResponse(
      {
        ok: true,
        inquiryId,
        message: 'Your custom order request has been received! We will get back to you within 24 hours.',
      },
      201,
      {},
      origin,
    )
  } catch (err) {
    context.error('submitCustomOrder failed', err)
    return errorResponse('Failed to submit request', 500, origin)
  }
}

// ─── GET /api/admin/custom-orders ────────────────────────────

async function adminListCustomOrders(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)

  const admin = requireAdmin(request)
  if (!admin) return errorResponse('Unauthorized', 401, origin)

  try {
    const status = request.query.get('status') || undefined
    const page = Math.max(1, parseInt(request.query.get('page') || '1', 10) || 1)
    const pageSize = Math.min(
      Math.max(1, parseInt(request.query.get('pageSize') || '20', 10) || 20),
      100,
    )

    let orders = await listCustomOrders(status)
    const total = orders.length
    orders = orders.slice((page - 1) * pageSize, page * pageSize)

    return jsonResponse({ orders: orders.map(toApi), total, page, pageSize }, 200, {}, origin)
  } catch (err) {
    context.error('adminListCustomOrders failed', err)
    return errorResponse('Failed to load custom orders', 500, origin)
  }
}

// ─── PATCH /api/admin/custom-orders/{id} ─────────────────────

async function adminUpdateCustomOrder(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)
  const csrfFail = enforceCsrf(request, origin)
  if (csrfFail) return csrfFail

  const admin = requireAdmin(request)
  if (!admin) return errorResponse('Unauthorized', 401, origin)

  const inquiryId = request.params.id
  if (!inquiryId) return errorResponse('Missing inquiry id', 400, origin)

  try {
    // Find the existing order (row key includes status prefix)
    const all = await listCustomOrders()
    const existing = all.find((o) => o.inquiryId === inquiryId)
    if (!existing) return errorResponse('Custom order not found', 404, origin)

    const body = (await request.json()) as {
      status?: CustomOrderStatus
      quotedAmount?: number
      adminNote?: string
    }

    const newStatus = body.status || existing.status
    const now = new Date().toISOString()

    // If status changed, we need a new row key
    if (body.status && body.status !== existing.status) {
      const newRow: Row = {
        ...existing,
        rowKey: `${newStatus}_${inquiryId}`,
        status: newStatus,
        quotedAmount: body.quotedAmount ?? existing.quotedAmount,
        adminNote: body.adminNote ?? existing.adminNote,
        updatedAt: now,
      }
      await createCustomOrder(newRow)
      // Delete old row
      try {
        if (!customOrdersTableClient) {
          throw new Error('customOrders TableClient unavailable (AZURE_STORAGE_ACCOUNT_NAME unset)')
        }
        await customOrdersTableClient.deleteEntity('inbox', existing.rowKey)
      } catch (deleteErr) {
        // Non-fatal - the new row was already written. Log for manual cleanup.
        context.warn('adminUpdateCustomOrder: old row deletion failed after status move (non-fatal, manual cleanup may be needed)', {
          oldRowKey: existing.rowKey,
          newRowKey: `${newStatus}_${inquiryId}`,
          error: String(deleteErr),
        })
      }
      return jsonResponse({ order: toApi(newRow) }, 200, {}, origin)
    }

    const updated: Row = {
      ...existing,
      quotedAmount: body.quotedAmount ?? existing.quotedAmount,
      adminNote: body.adminNote ?? existing.adminNote,
      updatedAt: now,
    }
    await updateCustomOrder(updated)
    return jsonResponse({ order: toApi(updated) }, 200, {}, origin)
  } catch (err) {
    context.error('adminUpdateCustomOrder failed', err)
    return errorResponse('Failed to update custom order', 500, origin)
  }
}

// ─── Route registrations ─────────────────────────────────────

app.http('submitCustomOrder', {
  methods: ['POST', 'OPTIONS'],
  route: 'api/custom-orders',
  authLevel: 'anonymous',
  handler: submitCustomOrder,
})

app.http('adminListCustomOrders', {
  methods: ['GET', 'OPTIONS'],
  route: 'api/admin/custom-orders',
  authLevel: 'anonymous',
  handler: adminListCustomOrders,
})

app.http('adminUpdateCustomOrder', {
  methods: ['PATCH', 'OPTIONS'],
  route: 'api/admin/custom-orders/{id}',
  authLevel: 'anonymous',
  handler: adminUpdateCustomOrder,
})
