/**
 * Shipping settings — admin-configurable delivery charge + threshold.
 *
 *   GET   /api/shipping-settings        public  — cart / checkout read
 *   GET   /api/admin/shipping-settings  admin   — read for the form
 *   PATCH /api/admin/shipping-settings  admin   — save the form
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { requireAdmin } from '../middleware/adminGuard'
import { enforceCsrf } from '../middleware/csrfGuard'
import { jsonResponse, errorResponse, corsPreflightResponse } from '../utils/response'
import { getShippingConfig, setShippingConfig, ShippingConfig } from '../services/shippingConfig'

// Public — the cart and checkout pages read this on every render to
// price shipping correctly. Short cache so admin changes propagate
// within a minute.
async function getPublicShippingSettings(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)
  try {
    const cfg = await getShippingConfig()
    return jsonResponse({ shipping: cfg }, 200, { 'Cache-Control': 'public, max-age=60' }, origin)
  } catch (err) {
    context.error('getPublicShippingSettings failed', err)
    return errorResponse('Could not load shipping settings', 500, origin)
  }
}

// Admin — read the same config, no caching.
async function adminGetShippingSettings(
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
    const cfg = await getShippingConfig()
    return jsonResponse({ shipping: cfg }, 200, { 'Cache-Control': 'no-store' }, origin)
  } catch (err) {
    context.error('adminGetShippingSettings failed', err)
    return errorResponse('Could not load shipping settings', 500, origin)
  }
}

// Admin — save the form. Input validation lives here so the service
// stays a pure data layer.
async function adminUpdateShippingSettings(
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
    const body = (await request.json()) as Partial<ShippingConfig>

    // Coerce + sanity-check the numbers up front for clearer error
    // messages than the service layer's silent clamp.
    if (!isFiniteNonNegativeInt(body.baseCharge)) {
      return errorResponse('baseCharge must be a non-negative integer (paise)', 400, origin)
    }
    if (!isFiniteNonNegativeInt(body.effectiveCharge)) {
      return errorResponse('effectiveCharge must be a non-negative integer (paise)', 400, origin)
    }
    if (!isFiniteNonNegativeInt(body.freeThreshold)) {
      return errorResponse('freeThreshold must be a non-negative integer (paise)', 400, origin)
    }
    if ((body.effectiveCharge as number) > (body.baseCharge as number)) {
      return errorResponse(
        'Discounted charge cannot be more than the standard charge',
        400,
        origin,
      )
    }
    if (body.discountLabel != null && typeof body.discountLabel !== 'string') {
      return errorResponse('discountLabel must be a string', 400, origin)
    }
    if (typeof body.discountLabel === 'string' && body.discountLabel.length > 80) {
      return errorResponse('discountLabel must be 80 characters or less', 400, origin)
    }
    // Light upper bound — catches data-entry mistakes like ₹99000 vs ₹990.
    const MAX_PAISE = 100_000_00 // ₹1,00,000
    if (
      (body.baseCharge as number) > MAX_PAISE ||
      (body.effectiveCharge as number) > MAX_PAISE ||
      (body.freeThreshold as number) > MAX_PAISE * 10
    ) {
      return errorResponse('Value is unreasonably large; double-check the rupee/paise unit', 400, origin)
    }

    const saved = await setShippingConfig({
      baseCharge: body.baseCharge as number,
      effectiveCharge: body.effectiveCharge as number,
      freeThreshold: body.freeThreshold as number,
      discountLabel: body.discountLabel || undefined,
    })

    return jsonResponse({ shipping: saved }, 200, { 'Cache-Control': 'no-store' }, origin)
  } catch (err) {
    if (err instanceof SyntaxError) {
      return errorResponse('Invalid request body', 400, origin)
    }
    context.error('adminUpdateShippingSettings failed', err)
    return errorResponse('Could not save shipping settings', 500, origin)
  }
}

function isFiniteNonNegativeInt(v: unknown): v is number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return false
  if (v < 0) return false
  if (!Number.isInteger(v)) return false
  return true
}

app.http('getPublicShippingSettings', {
  methods: ['GET', 'OPTIONS'],
  route: 'api/shipping-settings',
  authLevel: 'anonymous',
  handler: getPublicShippingSettings,
})

app.http('adminGetShippingSettings', {
  methods: ['GET', 'OPTIONS'],
  route: 'api/admin/shipping-settings',
  authLevel: 'anonymous',
  handler: adminGetShippingSettings,
})

app.http('adminUpdateShippingSettings', {
  methods: ['PATCH'],
  route: 'api/admin/shipping-settings',
  authLevel: 'anonymous',
  handler: adminUpdateShippingSettings,
})
