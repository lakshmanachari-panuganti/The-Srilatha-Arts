/**
 * Custom Order Inquiry Endpoints (§4.2, §5.2).
 *
 * POST  /api/custom-orders          — public submission (rate-limited)
 * GET   /api/admin/custom-orders    — admin Kanban listing
 * PATCH /api/admin/custom-orders/{id} — update status/quote
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import {
  createCustomOrder,
  listCustomOrders,
  getCustomOrder,
  updateCustomOrder,
  Row,
} from '../services/tableStorage'
import { requireAdmin } from '../middleware/adminGuard'
import { jsonResponse, errorResponse, corsPreflightResponse } from '../utils/response'
import { checkAndIncrement } from '../services/rateLimit'
import { enqueueNotification } from '../services/queue'
import { randomUUID } from 'crypto'
import type { CustomOrderStatus } from '../types'

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

    if (!body.customerName) return errorResponse('Name is required', 400, origin)
    if (!body.customerPhone && !body.customerEmail) {
      return errorResponse('Phone or email is required', 400, origin)
    }
    if (!body.artForm) return errorResponse('Art form is required', 400, origin)
    if (!body.description) return errorResponse('Description is required', 400, origin)

    const inquiryId = randomUUID().slice(0, 12)
    const now = new Date().toISOString()

    const row: Row = {
      partitionKey: 'inbox',
      rowKey: `NEW_${inquiryId}`,
      inquiryId,
      status: 'NEW',
      customerName: body.customerName.trim(),
      customerEmail: body.customerEmail?.toLowerCase().trim() || '',
      customerPhone: body.customerPhone?.trim() || '',
      artForm: body.artForm,
      size: body.size || '',
      palette: body.palette || '',
      description: body.description.trim(),
      referenceImages: body.referenceImages ? JSON.stringify(body.referenceImages) : '[]',
      budget: body.budget || '',
      createdAt: now,
      updatedAt: now,
    }

    await createCustomOrder(row)

    // Notify admin about new inquiry
    try {
      await enqueueNotification({
        userEmail: 'admin',
        channel: 'email',
        templateKey: 'custom_order_new',
        vars: {
          customerName: body.customerName,
          artForm: body.artForm,
          inquiryId,
        },
      })
    } catch {
      // Non-fatal — admin will see it in the dashboard
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
    const orders = await listCustomOrders(status)
    return jsonResponse({ orders: orders.map(toApi) }, 200, {}, origin)
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
        const { TableClient } = require('@azure/data-tables')
        const { DefaultAzureCredential } = require('@azure/identity')
        const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME!
        const client = new TableClient(
          `https://${accountName}.table.core.windows.net`,
          'customOrders',
          new DefaultAzureCredential(),
        )
        await client.deleteEntity('inbox', existing.rowKey)
      } catch {
        // Non-fatal
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
