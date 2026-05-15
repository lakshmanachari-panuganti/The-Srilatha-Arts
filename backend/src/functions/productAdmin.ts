/**
 * Product Admin CRUD (extends the read-only products.ts).
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { upsertProduct, deleteProduct, getProduct, appendAuditLog, Row } from '../services/tableStorage'
import { requireAdmin } from '../middleware/adminGuard'
import { jsonResponse, errorResponse, corsPreflightResponse, noContent } from '../utils/response'
import { randomUUID } from 'crypto'

// ─── POST /api/admin/products ────────────────────────────────

async function adminCreateProduct(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)

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

    const updated: Row = {
      ...existing,
      ...body,
      partitionKey: category,
      rowKey: id,
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

  const admin = requireAdmin(request)
  if (!admin) return errorResponse('Unauthorized', 401, origin)

  const id = request.params.id
  if (!id) return errorResponse('Missing product id', 400, origin)

  try {
    const category = id.slice(0, -9)   // e.g. 'dot-mandala-f55f2641' → 'dot-mandala'
    await deleteProduct(category, id)

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

// ─── Route registrations ─────────────────────────────────────

app.http('adminCreateProduct', {
  methods: ['POST', 'OPTIONS'],
  route: 'api/admin/products',
  authLevel: 'anonymous',
  handler: adminCreateProduct,
})

// Note: OPTIONS is NOT listed here — adminDeleteProduct already registers OPTIONS
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
