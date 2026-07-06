/**
 * Review Endpoints (§4.2, §5.2).
 *
 * Public:
 *   GET  /api/reviews/product/{id}     - moderated reviews for a product
 *
 * Customer:
 *   GET  /api/reviews/eligibility?productId=...  - can I review this?
 *   POST /api/reviews                  - submit review (gated: must have DELIVERED order)
 *
 * Admin:
 *   GET   /api/admin/reviews           - moderation queue
 *   PATCH /api/admin/reviews/{id}      - approve/hide/reply
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import {
  getReviewsByProduct,
  createReview,
  getReview,
  updateReview,
  getAllReviews,
  getReviewByUser,
  getOrdersByUser,
  Row,
} from '../services/tableStorage'
import { requireUser } from '../middleware/userGuard'
import { requireAdmin } from '../middleware/adminGuard'
import { enforceCsrf } from '../middleware/csrfGuard'
import { jsonResponse, errorResponse, corsPreflightResponse } from '../utils/response'
import { randomUUID } from 'crypto'

function toApi(row: Row) {
  return {
    id: row.rowKey,
    productId: row.partitionKey,
    userName: row.userName,
    rating: row.rating,
    title: row.title || undefined,
    body: row.body,
    photos: safeJson(row.photos) || [],
    status: row.status,
    adminReply: row.adminReply || undefined,
    adminRepliedAt: row.adminRepliedAt || undefined,
    createdAt: row.createdAt,
  }
}

function safeJson(val: unknown): unknown {
  if (!val) return undefined
  if (typeof val === 'object') return val
  try { return JSON.parse(String(val)) } catch { return val }
}

// ─── GET /api/reviews/product/{id} ───────────────────────────

async function productReviews(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)

  const productId = request.params.id
  if (!productId) return errorResponse('Missing product id', 400, origin)

  try {
    const reviews = await getReviewsByProduct(productId, true)
    const avgRating =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + (r.rating ?? 0), 0) / reviews.length
        : 0

    return jsonResponse(
      {
        reviews: reviews.map(toApi),
        total: reviews.length,
        averageRating: Math.round(avgRating * 10) / 10,
      },
      200,
      { 'Cache-Control': 'public, max-age=120' },
      origin,
    )
  } catch (err) {
    context.error('productReviews failed', err)
    return errorResponse('Failed to load reviews', 500, origin)
  }
}

// ─── GET /api/reviews/eligibility?productId=... ─────────────
//
// Lightweight pre-flight so the PDP can hide or contextualise the
// "Write a review" CTA instead of letting a user fill out a form and
// hit 401 / 403 on submit. The eligibility rules mirror submitReview()
// below: caller must be authenticated, must have a DELIVERED order
// containing the product, and must not have already reviewed it.

async function reviewEligibility(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)

  const user = requireUser(request)
  if (!user) {
    // 200 + eligible:false on purpose - anonymous visitors shouldn't get
    // a console-noisy 401; the PDP just renders the "sign in to review"
    // CTA. Reason is informational.
    return jsonResponse(
      { eligible: false, reason: 'not-authenticated' as const },
      200,
      {},
      origin,
    )
  }

  const productId = request.query.get('productId')
  if (!productId) return errorResponse('productId is required', 400, origin)

  try {
    // Look for a DELIVERED order containing this product.
    const orders = await getOrdersByUser(user.userId)
    let purchased = false
    for (const o of orders) {
      if (o.status !== 'DELIVERED') continue
      const items = safeJson(o.items)
      if (!Array.isArray(items)) continue
      if (items.some((i: { productId: string }) => i.productId === productId)) {
        purchased = true
        break
      }
    }
    if (!purchased) {
      return jsonResponse({ eligible: false, reason: 'no-delivered-order' as const }, 200, {}, origin)
    }

    const existing = await getReviewByUser(productId, user.userId)
    if (existing) {
      return jsonResponse({ eligible: false, reason: 'already-reviewed' as const }, 200, {}, origin)
    }

    return jsonResponse({ eligible: true }, 200, {}, origin)
  } catch (err) {
    context.error('reviewEligibility failed', err)
    return errorResponse('Failed to check eligibility', 500, origin)
  }
}

// ─── POST /api/reviews ───────────────────────────────────────

async function submitReview(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)
  const csrfFail = enforceCsrf(request, origin)
  if (csrfFail) return csrfFail

  const user = requireUser(request)
  if (!user) return errorResponse('Authentication required', 401, origin)

  try {
    const body = (await request.json()) as {
      productId?: string
      rating?: number
      title?: string
      body?: string
      photos?: string[]
    }

    if (!body.productId) return errorResponse('Product ID is required', 400, origin)
    if (!body.rating || body.rating < 1 || body.rating > 5) {
      return errorResponse('Rating must be 1-5', 400, origin)
    }
    if (!body.body?.trim()) return errorResponse('Review body is required', 400, origin)
    if (body.body.trim().length > 2000) {
      return errorResponse('Review must be 2000 characters or less', 400, origin)
    }
    if (body.title && body.title.length > 200) {
      return errorResponse('Review title must be 200 characters or less', 400, origin)
    }
    if (body.photos && body.photos.length > 10) {
      return errorResponse('Maximum 10 photos allowed per review', 400, origin)
    }

    // Verify user has a DELIVERED order containing this product, and
    // capture THAT order's id (not just any delivered order) for the
    // proof-of-purchase trail. Previously the orderId field could record
    // an unrelated order, which made review-source auditing unreliable.
    const orders = await getOrdersByUser(user.userId)
    let proofOrderId = ''
    for (const o of orders) {
      if (o.status !== 'DELIVERED') continue
      const items = safeJson(o.items)
      if (!Array.isArray(items)) continue
      if (items.some((i: { productId: string }) => i.productId === body.productId)) {
        proofOrderId = o.rowKey
        break
      }
    }
    if (!proofOrderId) {
      return errorResponse(
        'You can only review products from delivered orders',
        403,
        origin,
      )
    }

    // Prevent duplicate reviews from the same user for the same product (H-06).
    const existingReview = await getReviewByUser(body.productId, user.userId)
    if (existingReview) {
      return errorResponse('You have already submitted a review for this product', 409, origin)
    }

    // Sanitise photo URLs: only allow https:// hosted on our own blob domain.
    // Stops javascript:/data: URLs and prevents reviews from embedding hot
    // links to attacker-controlled servers (which could later turn malicious).
    const allowedHost = (() => {
      const base = process.env.BLOB_BASE_URL
      if (!base) return null
      try { return new URL(base).hostname.toLowerCase() } catch { return null }
    })()
    const photoUrls = Array.isArray(body.photos)
      ? body.photos
          .filter((u): u is string => typeof u === 'string')
          .map((u) => u.trim())
          .filter((u) => {
            try {
              const parsed = new URL(u)
              if (parsed.protocol !== 'https:') return false
              if (allowedHost && parsed.hostname.toLowerCase() !== allowedHost) return false
              return true
            } catch {
              return false
            }
          })
          .slice(0, 10)
      : []

    const reviewId = randomUUID().slice(0, 12)
    const now = new Date().toISOString()

    await createReview({
      partitionKey: body.productId,
      rowKey: reviewId,
      userEmail: user.userId,
      userName: user.userId.split('@')[0], // fallback; frontend can pass name
      rating: body.rating,
      title: body.title || '',
      body: body.body.trim(),
      photos: JSON.stringify(photoUrls),
      orderId: proofOrderId,
      status: 'pending',
      createdAt: now,
    })

    return jsonResponse({ ok: true, reviewId }, 201, {}, origin)
  } catch (err) {
    context.error('submitReview failed', err)
    return errorResponse('Failed to submit review', 500, origin)
  }
}

// ─── GET /api/reviews/recent ─────────────────────────────────
//
// Sitewide approved reviews for the homepage Testimonials carousel and the
// /reviews page. Replaces the hard-coded mock data that used to ship on those
// surfaces. Returns most-recent approved reviews across all products,
// optionally limited via ?limit=N (default 12, max 50).
//
// Public, cached briefly (60s) so this doesn't hammer the table on every
// homepage load. Anonymous - these are public reviews by design.

async function recentReviews(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)

  try {
    const limitRaw = parseInt(request.query.get('limit') || '12', 10)
    const limit = Math.min(Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 12), 50)

    const all = await getAllReviews('approved')
    // Sort by createdAt desc - most recent first.
    all.sort((a, b) => {
      const av = String(a.createdAt || '')
      const bv = String(b.createdAt || '')
      return bv.localeCompare(av)
    })
    const trimmed = all.slice(0, limit)

    return jsonResponse(
      { reviews: trimmed.map(toApi), total: trimmed.length },
      200,
      { 'Cache-Control': 'public, max-age=60' },
      origin,
    )
  } catch (err) {
    context.error('recentReviews failed', err)
    return errorResponse('Failed to load reviews', 500, origin)
  }
}

// ─── GET /api/admin/reviews ──────────────────────────────────

async function adminReviews(
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
      Math.max(1, parseInt(request.query.get('pageSize') || '50', 10) || 50),
      100,
    )

    let reviews = await getAllReviews(status)
    const total = reviews.length
    reviews = reviews.slice((page - 1) * pageSize, page * pageSize)

    return jsonResponse({ reviews: reviews.map(toApi), total, page, pageSize }, 200, {}, origin)
  } catch (err) {
    context.error('adminReviews failed', err)
    return errorResponse('Failed to load reviews', 500, origin)
  }
}

// ─── PATCH /api/admin/reviews/{id} ───────────────────────────

async function adminUpdateReview(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)
  const csrfFail = enforceCsrf(request, origin)
  if (csrfFail) return csrfFail

  const admin = requireAdmin(request)
  if (!admin) return errorResponse('Unauthorized', 401, origin)

  const reviewId = request.params.id
  if (!reviewId) return errorResponse('Missing review id', 400, origin)

  try {
    const body = (await request.json()) as {
      productId: string
      status?: 'approved' | 'hidden'
      adminReply?: string
    }

    if (!body.productId) return errorResponse('Product ID is required', 400, origin)

    const review = await getReview(body.productId, reviewId)
    if (!review) return errorResponse('Review not found', 404, origin)

    const updated = { ...review }
    if (body.status) updated.status = body.status
    if (body.adminReply !== undefined) {
      updated.adminReply = body.adminReply
      updated.adminRepliedAt = new Date().toISOString()
    }

    await updateReview(updated)
    return jsonResponse({ review: toApi(updated) }, 200, {}, origin)
  } catch (err) {
    context.error('adminUpdateReview failed', err)
    return errorResponse('Failed to update review', 500, origin)
  }
}

// ─── Route registrations ─────────────────────────────────────

app.http('productReviews', {
  methods: ['GET', 'OPTIONS'],
  route: 'api/reviews/product/{id}',
  authLevel: 'anonymous',
  handler: productReviews,
})

app.http('recentReviews', {
  methods: ['GET', 'OPTIONS'],
  route: 'api/reviews/recent',
  authLevel: 'anonymous',
  handler: recentReviews,
})

app.http('submitReview', {
  methods: ['POST', 'OPTIONS'],
  route: 'api/reviews',
  authLevel: 'anonymous',
  handler: submitReview,
})

app.http('reviewEligibility', {
  methods: ['GET', 'OPTIONS'],
  route: 'api/reviews/eligibility',
  authLevel: 'anonymous',
  handler: reviewEligibility,
})

app.http('adminReviews', {
  methods: ['GET', 'OPTIONS'],
  route: 'api/admin/reviews',
  authLevel: 'anonymous',
  handler: adminReviews,
})

app.http('adminUpdateReview', {
  methods: ['PATCH', 'OPTIONS'],
  route: 'api/admin/reviews/{id}',
  authLevel: 'anonymous',
  handler: adminUpdateReview,
})
