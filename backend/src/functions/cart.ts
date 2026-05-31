/**
 * Cart Endpoints — per-user persistence so the cart survives device
 * switches, browser clears, and incognito sessions, and so two users
 * sharing a browser don't see each other's items.
 *
 * GET    /api/cart                 — list user's cart (enriched)
 * POST   /api/cart                 — add or increment item
 * PATCH  /api/cart/{productId}     — set exact quantity (0 removes)
 * DELETE /api/cart/{productId}     — remove
 * DELETE /api/cart                 — clear entire cart (used after checkout)
 *
 * Shape of GET response mirrors the frontend's CartItem type so the
 * store can swap server data in without per-item product fetches.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import {
  getCart,
  upsertCartItem,
  removeCartItem,
  clearCart,
  getProductById,
  Row,
} from '../services/tableStorage'
import { requireUser } from '../middleware/userGuard'
import { enforceCsrf } from '../middleware/csrfGuard'
import { jsonResponse, errorResponse, corsPreflightResponse, noContent } from '../utils/response'

// Sane upper bound per line. Handcrafted inventory is one-of-a-kind, so
// 99 is the absolute ceiling — we'd never sell that many of a single
// piece in a single order. Stops users (or scripted clients) from
// posting absurd quantities.
const MAX_QTY_PER_ITEM = 99

async function enrich(rows: Row[]): Promise<unknown[]> {
  return Promise.all(
    rows.map(async (row) => {
      const product = await getProductById(row.rowKey as string)
      return {
        productId: row.rowKey,
        quantity: Number(row.quantity ?? 1),
        addedAt: row.addedAt,
        title: product?.title ?? '',
        slug: product?.slug || row.rowKey,
        category: product?.partitionKey ?? '',
        image: product?.imageUrl ?? '',
        price: product?.displayPrice ?? product?.price ?? 0,
        size: product?.size ?? '',
        inStock: product?.inStock !== false,
      }
    }),
  )
}

async function cartHandler(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)
  if (request.method !== 'GET') {
    const csrfFail = enforceCsrf(request, origin)
    if (csrfFail) return csrfFail
  }

  const user = requireUser(request)
  if (!user) return errorResponse('Authentication required', 401, origin)

  try {
    if (request.method === 'GET') {
      const rows = await getCart(user.userId)
      return jsonResponse({ items: await enrich(rows) }, 200, {}, origin)
    }

    if (request.method === 'POST') {
      const body = (await request.json()) as { productId?: string; quantity?: number }
      if (!body.productId) return errorResponse('productId is required', 400, origin)
      const product = await getProductById(body.productId)
      if (!product) return errorResponse('Product not found', 404, origin)

      // POST increments — fetch existing qty and add. PATCH is the way
      // to SET an absolute quantity.
      const existing = (await getCart(user.userId)).find((r) => r.rowKey === body.productId)
      const currentQty = Number(existing?.quantity ?? 0)
      const delta = Math.max(1, Math.floor(body.quantity ?? 1))
      const nextQty = Math.min(MAX_QTY_PER_ITEM, currentQty + delta)

      await upsertCartItem(user.userId, body.productId, nextQty)
      const rows = await getCart(user.userId)
      return jsonResponse({ items: await enrich(rows) }, 201, {}, origin)
    }

    if (request.method === 'DELETE') {
      // No {productId} param → clear entire cart (used after successful checkout).
      await clearCart(user.userId)
      return noContent(origin)
    }

    return errorResponse('Method not allowed', 405, origin)
  } catch (err) {
    context.error('cartHandler failed', err)
    return errorResponse('Failed to process cart', 500, origin)
  }
}

async function cartItemHandler(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)
  const csrfFail = enforceCsrf(request, origin)
  if (csrfFail) return csrfFail

  const user = requireUser(request)
  if (!user) return errorResponse('Authentication required', 401, origin)

  const productId = request.params.productId
  if (!productId) return errorResponse('Missing productId', 400, origin)

  try {
    if (request.method === 'PATCH') {
      const body = (await request.json()) as { quantity?: number }
      const qty = Number(body.quantity ?? 0)
      if (!Number.isFinite(qty)) return errorResponse('quantity must be a number', 400, origin)
      // qty 0 (or negative) → remove. Same semantics as the frontend
      // store's setQty.
      if (qty <= 0) {
        await removeCartItem(user.userId, productId)
      } else {
        await upsertCartItem(user.userId, productId, Math.min(MAX_QTY_PER_ITEM, qty))
      }
      const rows = await getCart(user.userId)
      return jsonResponse({ items: await enrich(rows) }, 200, {}, origin)
    }

    if (request.method === 'DELETE') {
      await removeCartItem(user.userId, productId)
      return noContent(origin)
    }

    return errorResponse('Method not allowed', 405, origin)
  } catch (err) {
    context.error('cartItemHandler failed', err)
    return errorResponse('Failed to update cart item', 500, origin)
  }
}

app.http('cart', {
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  route: 'api/cart',
  authLevel: 'anonymous',
  handler: cartHandler,
})

app.http('cartItem', {
  methods: ['PATCH', 'DELETE', 'OPTIONS'],
  route: 'api/cart/{productId}',
  authLevel: 'anonymous',
  handler: cartItemHandler,
})
