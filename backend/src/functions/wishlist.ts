/**
 * Wishlist Endpoints (§4.2).
 *
 * GET    /api/wishlist          — list user's wishlist
 * POST   /api/wishlist          — add item
 * DELETE /api/wishlist/{productId} — remove item
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  getProductById,
  Row,
} from '../services/tableStorage'
import { requireUser } from '../middleware/userGuard'
import { jsonResponse, errorResponse, corsPreflightResponse, noContent } from '../utils/response'

async function wishlistHandler(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)

  const user = requireUser(request)
  if (!user) return errorResponse('Authentication required', 401, origin)

  try {
    if (request.method === 'GET') {
      const items = await getWishlist(user.userId)
      // Enrich with product data
      const enriched = await Promise.all(
        items.map(async (item) => {
          const product = await getProductById(item.rowKey)
          return {
            productId: item.rowKey,
            addedAt: item.addedAt,
            title: product?.title,
            imageUrl: product?.imageUrl,
            displayPrice: product?.displayPrice,
            inStock: product?.inStock !== false,
          }
        }),
      )
      return jsonResponse({ items: enriched }, 200, {}, origin)
    }

    if (request.method === 'POST') {
      const body = (await request.json()) as { productId?: string }
      if (!body.productId) return errorResponse('Product ID is required', 400, origin)

      const product = await getProductById(body.productId)
      if (!product) return errorResponse('Product not found', 404, origin)

      await addToWishlist(user.userId, body.productId)
      return jsonResponse({ ok: true }, 201, {}, origin)
    }

    return errorResponse('Method not allowed', 405, origin)
  } catch (err) {
    context.error('wishlistHandler failed', err)
    return errorResponse('Failed to process wishlist', 500, origin)
  }
}

async function wishlistRemove(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)

  const user = requireUser(request)
  if (!user) return errorResponse('Authentication required', 401, origin)

  const productId = request.params.productId
  if (!productId) return errorResponse('Missing product ID', 400, origin)

  try {
    await removeFromWishlist(user.userId, productId)
    return noContent(origin)
  } catch (err) {
    context.error('wishlistRemove failed', err)
    return errorResponse('Failed to remove from wishlist', 500, origin)
  }
}

app.http('wishlist', {
  methods: ['GET', 'POST', 'OPTIONS'],
  route: 'api/wishlist',
  authLevel: 'anonymous',
  handler: wishlistHandler,
})

app.http('wishlistRemove', {
  methods: ['DELETE', 'OPTIONS'],
  route: 'api/wishlist/{productId}',
  authLevel: 'anonymous',
  handler: wishlistRemove,
})
