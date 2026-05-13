/**
 * Coupon Endpoints (§6).
 *
 * Public:
 *   GET   /api/coupons/active      — currently valid codes
 *   POST  /api/coupons/validate    — validate a code (rate-limited)
 *
 * Admin:
 *   GET   /api/admin/coupons
 *   POST  /api/admin/coupons
 *   GET   /api/admin/coupons/{code}
 *   PATCH /api/admin/coupons/{code}
 *   DELETE /api/admin/coupons/{code}
 *   GET   /api/admin/coupons/{code}/redemptions
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import {
  getCoupon,
  listCoupons,
  upsertCoupon,
  deleteCoupon,
  getCouponRedemptions,
  getCouponRedemptionsByUser,
  Row,
} from '../services/tableStorage'
import { requireAdmin } from '../middleware/adminGuard'
import { requireUser } from '../middleware/userGuard'
import { jsonResponse, errorResponse, corsPreflightResponse, noContent } from '../utils/response'
import { checkAndIncrement } from '../services/rateLimit'
import { randomUUID } from 'crypto'

function toApi(row: Row) {
  return {
    code: row.rowKey,
    type: row.type,
    value: row.value,
    minOrderAmount: row.minOrderAmount || undefined,
    maxDiscount: row.maxDiscount || undefined,
    applicableCategories: safeJson(row.applicableCategories),
    applicableProducts: safeJson(row.applicableProducts),
    firstTimeOnly: row.firstTimeOnly === true,
    stackable: row.stackable === true,
    usageLimit: row.usageLimit || undefined,
    perUserLimit: row.perUserLimit || undefined,
    currentUsage: row.currentUsage ?? 0,
    startDate: row.startDate,
    endDate: row.endDate,
    active: row.active !== false,
    promoteInBanner: row.promoteInBanner === true,
    description: row.description || undefined,
    createdAt: row.createdAt,
  }
}

function safeJson(val: unknown): unknown {
  if (!val) return undefined
  if (typeof val === 'object') return val
  try { return JSON.parse(String(val)) } catch { return val }
}

function getClientIp(request: HttpRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}

// ─── POST /api/coupons/validate ──────────────────────────────

async function validateCoupon(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)

  // Rate limit: 5/min/IP
  const ip = getClientIp(request)
  const rateCheck = await checkAndIncrement(`coupon_validate:${ip}`, 5, 60_000)
  if (!rateCheck.allowed) {
    return errorResponse('Too many attempts. Please try again later.', 429, origin)
  }

  try {
    const body = (await request.json()) as {
      code?: string
      items?: { productId: string; category: string; price: number; qty: number }[]
      userId?: string
    }

    if (!body.code) return errorResponse('Coupon code is required', 400, origin)
    const code = body.code.toUpperCase().trim()

    const coupon = await getCoupon(code)
    if (!coupon) {
      return jsonResponse(
        { valid: false, reason: 'INVALID', message: 'This coupon code does not exist' },
        200,
        {},
        origin,
      )
    }

    // Check active
    if (coupon.active === false) {
      return jsonResponse(
        { valid: false, reason: 'INACTIVE', message: 'This coupon is no longer active' },
        200,
        {},
        origin,
      )
    }

    // Check date range
    const now = Date.now()
    if (coupon.startDate && new Date(String(coupon.startDate)).getTime() > now) {
      return jsonResponse(
        { valid: false, reason: 'INACTIVE', message: 'This coupon is not yet active' },
        200,
        {},
        origin,
      )
    }
    if (coupon.endDate && new Date(String(coupon.endDate)).getTime() < now) {
      return jsonResponse(
        { valid: false, reason: 'EXPIRED', message: 'This coupon has expired' },
        200,
        {},
        origin,
      )
    }

    // Check usage limit
    if (coupon.usageLimit && (coupon.currentUsage ?? 0) >= coupon.usageLimit) {
      return jsonResponse(
        { valid: false, reason: 'USED', message: 'This coupon has reached its usage limit' },
        200,
        {},
        origin,
      )
    }

    // Check per-user limit
    if (body.userId && coupon.perUserLimit) {
      const userRedemptions = await getCouponRedemptionsByUser(code, body.userId)
      if (userRedemptions.length >= coupon.perUserLimit) {
        return jsonResponse(
          { valid: false, reason: 'USED', message: 'You have already used this coupon' },
          200,
          {},
          origin,
        )
      }
    }

    // Check first-time-only
    if (coupon.firstTimeOnly && body.userId) {
      const allRedemptions = await getCouponRedemptionsByUser(code, body.userId)
      if (allRedemptions.length > 0) {
        return jsonResponse(
          { valid: false, reason: 'USED', message: 'This coupon is for first-time buyers only' },
          200,
          {},
          origin,
        )
      }
    }

    // Calculate discount
    let cartTotal = 0
    if (body.items) {
      for (const item of body.items) {
        cartTotal += item.price * item.qty
      }
    }

    // Check min order amount
    if (coupon.minOrderAmount && cartTotal < coupon.minOrderAmount) {
      const needed = ((coupon.minOrderAmount - cartTotal) / 100).toFixed(0)
      return jsonResponse(
        {
          valid: false,
          reason: 'MIN_SPEND',
          message: `Minimum order ₹${(coupon.minOrderAmount / 100).toFixed(0)} required (add ₹${needed} more)`,
        },
        200,
        {},
        origin,
      )
    }

    let discount = 0
    let appliedTo: 'cart' | 'shipping' = 'cart'

    switch (coupon.type) {
      case 'PERCENTAGE':
        discount = Math.floor(cartTotal * (coupon.value / 100))
        if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount)
        break
      case 'FIXED_AMOUNT':
        discount = coupon.value
        break
      case 'FREE_SHIPPING':
        discount = 9900 // ₹99 shipping
        appliedTo = 'shipping'
        break
      default:
        discount = 0
    }

    return jsonResponse(
      {
        valid: true,
        code,
        discountAmount: discount,
        displayDiscount: discount / 100,
        appliedTo,
        message: coupon.description || `Coupon ${code} applied!`,
      },
      200,
      {},
      origin,
    )
  } catch (err) {
    context.error('validateCoupon failed', err)
    return errorResponse('Validation failed', 500, origin)
  }
}

// ─── GET /api/coupons/active ─────────────────────────────────

async function activeCoupons(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)

  try {
    const all = await listCoupons()
    const now = Date.now()
    const active = all.filter((c) => {
      if (c.active === false) return false
      if (c.startDate && new Date(String(c.startDate)).getTime() > now) return false
      if (c.endDate && new Date(String(c.endDate)).getTime() < now) return false
      if (c.usageLimit && (c.currentUsage ?? 0) >= c.usageLimit) return false
      if (c.firstTimeOnly) return false // Don't show first-time codes publicly
      return true
    })

    return jsonResponse(
      {
        coupons: active.map((c) => ({
          code: c.rowKey,
          type: c.type,
          value: c.value,
          description: c.description,
          minOrderAmount: c.minOrderAmount,
        })),
      },
      200,
      { 'Cache-Control': 'public, max-age=60' },
      origin,
    )
  } catch (err) {
    context.error('activeCoupons failed', err)
    return errorResponse('Failed to load coupons', 500, origin)
  }
}

// ─── Admin CRUD ──────────────────────────────────────────────

async function adminCoupons(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)

  const admin = requireAdmin(request)
  if (!admin) return errorResponse('Unauthorized', 401, origin)

  try {
    if (request.method === 'GET') {
      const coupons = await listCoupons()
      return jsonResponse({ coupons: coupons.map(toApi) }, 200, {}, origin)
    }

    if (request.method === 'POST') {
      const body = (await request.json()) as Record<string, unknown>
      if (!body.code || !body.type) {
        return errorResponse('Code and type are required', 400, origin)
      }

      const code = String(body.code).toUpperCase().trim()
      const existing = await getCoupon(code)
      if (existing) return errorResponse(`Coupon ${code} already exists`, 409, origin)

      const now = new Date().toISOString()
      const row: Row = {
        partitionKey: 'coupon',
        rowKey: code,
        type: body.type,
        value: body.value ?? 0,
        minOrderAmount: body.minOrderAmount ?? undefined,
        maxDiscount: body.maxDiscount ?? undefined,
        applicableCategories: body.applicableCategories ? JSON.stringify(body.applicableCategories) : 'ALL',
        applicableProducts: body.applicableProducts ? JSON.stringify(body.applicableProducts) : 'ALL',
        firstTimeOnly: body.firstTimeOnly === true,
        stackable: body.stackable === true,
        usageLimit: body.usageLimit ?? undefined,
        perUserLimit: body.perUserLimit ?? undefined,
        currentUsage: 0,
        startDate: body.startDate ?? now,
        endDate: body.endDate ?? '',
        active: body.active !== false,
        promoteInBanner: body.promoteInBanner === true,
        description: body.description ?? '',
        createdAt: now,
        updatedAt: now,
      }

      await upsertCoupon(row)
      return jsonResponse({ coupon: toApi(row) }, 201, {}, origin)
    }

    return errorResponse('Method not allowed', 405, origin)
  } catch (err) {
    context.error('adminCoupons failed', err)
    return errorResponse('Internal error', 500, origin)
  }
}

async function adminCouponById(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)

  const admin = requireAdmin(request)
  if (!admin) return errorResponse('Unauthorized', 401, origin)

  const code = request.params.code?.toUpperCase()
  if (!code) return errorResponse('Missing coupon code', 400, origin)

  try {
    if (request.method === 'GET') {
      const coupon = await getCoupon(code)
      if (!coupon) return errorResponse('Coupon not found', 404, origin)
      return jsonResponse({ coupon: toApi(coupon) }, 200, {}, origin)
    }

    if (request.method === 'PATCH') {
      const existing = await getCoupon(code)
      if (!existing) return errorResponse('Coupon not found', 404, origin)
      const body = (await request.json()) as Record<string, unknown>
      const updated: any = { ...existing, ...body, rowKey: code, updatedAt: new Date().toISOString() }
      if (Array.isArray(updated.applicableCategories)) {
        updated.applicableCategories = JSON.stringify(updated.applicableCategories)
      }
      if (Array.isArray(updated.applicableProducts)) {
        updated.applicableProducts = JSON.stringify(updated.applicableProducts)
      }
      await upsertCoupon(updated as Row)
      return jsonResponse({ coupon: toApi(updated) }, 200, {}, origin)
    }

    if (request.method === 'DELETE') {
      await deleteCoupon(code)
      return noContent(origin)
    }

    return errorResponse('Method not allowed', 405, origin)
  } catch (err) {
    context.error('adminCouponById failed', err)
    return errorResponse('Internal error', 500, origin)
  }
}

async function adminCouponRedemptions(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)

  const admin = requireAdmin(request)
  if (!admin) return errorResponse('Unauthorized', 401, origin)

  const code = request.params.code?.toUpperCase()
  if (!code) return errorResponse('Missing coupon code', 400, origin)

  try {
    const redemptions = await getCouponRedemptions(code)
    return jsonResponse(
      {
        redemptions: redemptions.map((r) => ({
          orderId: r.rowKey,
          userEmail: r.userEmail,
          discountAmount: r.discountAmount,
          redeemedAt: r.redeemedAt,
        })),
      },
      200,
      {},
      origin,
    )
  } catch (err) {
    context.error('adminCouponRedemptions failed', err)
    return errorResponse('Internal error', 500, origin)
  }
}

// ─── Route registrations ─────────────────────────────────────

app.http('validateCoupon', {
  methods: ['POST', 'OPTIONS'],
  route: 'api/coupons/validate',
  authLevel: 'anonymous',
  handler: validateCoupon,
})

app.http('activeCoupons', {
  methods: ['GET', 'OPTIONS'],
  route: 'api/coupons/active',
  authLevel: 'anonymous',
  handler: activeCoupons,
})

app.http('adminCoupons', {
  methods: ['GET', 'POST', 'OPTIONS'],
  route: 'api/admin/coupons',
  authLevel: 'anonymous',
  handler: adminCoupons,
})

app.http('adminCouponById', {
  methods: ['GET', 'PATCH', 'DELETE', 'OPTIONS'],
  route: 'api/admin/coupons/{code}',
  authLevel: 'anonymous',
  handler: adminCouponById,
})

app.http('adminCouponRedemptions', {
  methods: ['GET', 'OPTIONS'],
  route: 'api/admin/coupons/{code}/redemptions',
  authLevel: 'anonymous',
  handler: adminCouponRedemptions,
})
