/**
 * Product Admin CRUD (extends the read-only products.ts).
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import {
  upsertProduct,
  deleteProduct,
  getProduct,
  getAllProductsUncached,
  appendAuditLog,
  Row,
} from '../services/tableStorage'
import { toApi } from '../utils/productApi'
import { deleteProductImageByUrl } from '../services/blobStorage'
import { requireAdmin } from '../middleware/adminGuard'
import { enforceCsrf } from '../middleware/csrfGuard'
import { jsonResponse, errorResponse, corsPreflightResponse, noContent } from '../utils/response'
import { randomUUID } from 'crypto'

// ─── POST /api/admin/products ────────────────────────────────

async function adminCreateProduct(
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
    const body = (await request.json()) as Record<string, unknown>
    if (!body.title || !body.category) {
      return errorResponse('Title and category are required', 400, origin)
    }

    const category = String(body.category).toLowerCase()
    const id = `${category}-${randomUUID().slice(0, 8)}`
    const now = new Date().toISOString()

    const product: Row = {
      partitionKey: category,
      rowKey: id,
      title: body.title,
      slug: body.slug || id,
      price: body.price ?? 0,
      displayPrice: body.displayPrice ?? 0,
      compareAtPrice: body.compareAtPrice ?? undefined,
      size: body.size ?? '',
      material: body.material ?? '',
      description: body.description ?? '',
      shortDescription: body.shortDescription ?? '',
      careInstructions: body.careInstructions ?? '',
      timeToMake: body.timeToMake ?? '5 days',
      imageUrl: body.imageUrl ?? '',
      additionalImages: JSON.stringify(body.additionalImages ?? []),
      inStock: body.inStock !== false,
      stockQty: body.stockQty ?? 0,
      featured: body.featured === true,
      isNewArrival: body.isNewArrival === true,
      isBestSeller: body.isBestSeller === true,
      sortOrder: body.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
    }

    await upsertProduct(product)

    await appendAuditLog({
      partitionKey: 'admin',
      rowKey: `${now}_${admin.adminId}`,
      staffId: admin.adminId,
      action: 'product.create',
      resourceType: 'product',
      resourceId: id,
      createdAt: now,
    })

    return jsonResponse({ product: { id, ...body } }, 201, {}, origin)
  } catch (err) {
    context.error('adminCreateProduct failed', err)
    return errorResponse('Failed to create product', 500, origin)
  }
}

// ─── PATCH /api/admin/products/{id} ──────────────────────────

async function adminUpdateProduct(
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
  if (!id) return errorResponse('Missing product id', 400, origin)

  try {
    const category = id.slice(0, -9)   // e.g. 'dot-mandala-f55f2641' → 'dot-mandala'
    const existing = await getProduct(category, id)
    if (!existing) return errorResponse('Product not found', 404, origin)

    const body = (await request.json()) as Record<string, unknown>
    const now = new Date().toISOString()

    // Authoritative partitionKey/rowKey come from the existing entity so a
    // forged body field cannot move/duplicate the row across partitions.
    const updated: Row = {
      ...existing,
      ...body,
      partitionKey: existing.partitionKey,
      rowKey: existing.rowKey,
      updatedAt: now,
    }

    // Ensure additionalImages is serialized
    if (Array.isArray(updated.additionalImages)) {
      updated.additionalImages = JSON.stringify(updated.additionalImages)
    }

    await upsertProduct(updated)

    await appendAuditLog({
      partitionKey: 'admin',
      rowKey: `${now}_${admin.adminId}`,
      staffId: admin.adminId,
      action: 'product.update',
      resourceType: 'product',
      resourceId: id,
      details: JSON.stringify(Object.keys(body)),
      createdAt: now,
    })

    return jsonResponse({ ok: true }, 200, {}, origin)
  } catch (err) {
    context.error('adminUpdateProduct failed', err)
    return errorResponse('Failed to update product', 500, origin)
  }
}

// ─── DELETE /api/admin/products/{id} ─────────────────────────

async function adminDeleteProduct(
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
  if (!id) return errorResponse('Missing product id', 400, origin)

  try {
    const category = id.slice(0, -9)   // e.g. 'dot-mandala-f55f2641' → 'dot-mandala'

    // Read the row before deleting so we can clean up its image blobs
    // after the table delete succeeds. If it's already gone, skip blob
    // cleanup and let deleteProduct's 404 surface as the existing error.
    const existing = await getProduct(category, id)

    await deleteProduct(category, id)

    if (existing) {
      const imageUrls: string[] = []
      if (typeof existing.imageUrl === 'string' && existing.imageUrl) {
        imageUrls.push(existing.imageUrl)
      }
      const extra = existing.additionalImages
      if (typeof extra === 'string' && extra) {
        try {
          const arr = JSON.parse(extra)
          if (Array.isArray(arr)) {
            for (const u of arr) {
              if (typeof u === 'string' && u) imageUrls.push(u)
            }
          }
        } catch {
          // Malformed JSON - nothing to clean up for the extras.
        }
      }
      // Best-effort: the table row is already gone, so a blob delete
      // failure just leaves an orphan (recoverable). Log and continue.
      const results = await Promise.allSettled(
        imageUrls.map((u) => deleteProductImageByUrl(u)),
      )
      results.forEach((r, i) => {
        if (r.status === 'rejected') {
          context.warn(`product.delete: blob cleanup failed for ${imageUrls[i]}`, r.reason)
        }
      })
    }

    await appendAuditLog({
      partitionKey: 'admin',
      rowKey: `${new Date().toISOString()}_${admin.adminId}`,
      staffId: admin.adminId,
      action: 'product.delete',
      resourceType: 'product',
      resourceId: id,
      createdAt: new Date().toISOString(),
    })

    return noContent(origin)
  } catch (err) {
    context.error('adminDeleteProduct failed', err)
    return errorResponse('Failed to delete product', 500, origin)
  }
}

// ─── GET /api/admin/products ─────────────────────────────────

/**
 * Admin product listing — deliberately uncached.
 *
 * The admin UI previously read the public `GET /api/products`, which now
 * carries `Cache-Control: public, max-age=60` plus an in-process TTL
 * cache. That combination is right for the storefront and wrong here: an
 * admin who saves an edit and is redirected back to the list would be
 * served their own browser's stale copy and conclude the save failed.
 *
 * This route reads straight through to storage and returns `no-store`.
 * Admin traffic is a rounding error, so there is nothing to gain by
 * caching it and a real UX bug to avoid.
 */
async function adminListProducts(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)

  const admin = requireAdmin(request)
  if (!admin) return errorResponse('Unauthorized', 401, origin)

  try {
    const rows = await getAllProductsUncached()
    return jsonResponse(
      { products: rows.map(toApi) },
      200,
      { 'Cache-Control': 'no-store' },
      origin,
    )
  } catch (err) {
    context.error('adminListProducts failed', err)
    return errorResponse('Failed to load products', 500, origin)
  }
}

// ─── Route registrations ─────────────────────────────────────

app.http('adminCreateProduct', {
  methods: ['POST', 'OPTIONS'],
  route: 'api/admin/products',
  authLevel: 'anonymous',
  handler: adminCreateProduct,
})

// OPTIONS is NOT listed — adminCreateProduct already registers it on this
// route, and duplicate OPTIONS registrations make Functions v4 silently
// drop a handler (see the note below).
app.http('adminListProducts', {
  methods: ['GET'],
  route: 'api/admin/products',
  authLevel: 'anonymous',
  handler: adminListProducts,
})

// Note: OPTIONS is NOT listed here - adminDeleteProduct already registers OPTIONS
// on this route. Registering OPTIONS in two functions on the same route causes
// Azure Functions v4 to silently drop one handler (the PATCH handler was lost).
app.http('adminUpdateProduct', {
  methods: ['PATCH'],
  route: 'api/admin/products/{id}',
  authLevel: 'anonymous',
  handler: adminUpdateProduct,
})

app.http('adminDeleteProduct', {
  methods: ['DELETE', 'OPTIONS'],
  route: 'api/admin/products/{id}',
  authLevel: 'anonymous',
  handler: adminDeleteProduct,
})
