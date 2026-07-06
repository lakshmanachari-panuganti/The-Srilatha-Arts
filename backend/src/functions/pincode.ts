/**
 * GET /api/pincode/{pin}
 *
 * Resolves a 6-digit Indian postal pincode to its city, state, and country
 * so the checkout form can auto-fill those fields on mobile. Backed by
 * IndiaPost's free public API; proxied through our backend for two reasons:
 *
 *   1. CSP - staticwebapp.config.json's connect-src whitelist intentionally
 *      doesn't include third-party endpoints. Going through our own API
 *      means no CSP changes and a stable contract if we ever swap providers.
 *
 *   2. Caching - IndiaPost responses are cacheable for hours. We add our
 *      own 24h Cache-Control so a popular PIN is served from CDN/browser
 *      cache after the first lookup. (Future enhancement: a small Table
 *      Storage cache so we don't hit upstream even on cold starts.)
 *
 * Response shape (200):
 *   { pincode: "500001", city: "Hyderabad", district: "Hyderabad",
 *     state: "Telangana", country: "India" }
 *
 * Failures:
 *   400 - invalid PIN format
 *   404 - PIN not found upstream
 *   502 - upstream IndiaPost API unreachable / malformed
 *
 * The endpoint is anonymous - PIN data is public, no auth needed.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { jsonResponse, errorResponse, corsPreflightResponse } from '../utils/response'

interface IndiaPostOffice {
  Name?: string
  District?: string
  Block?: string
  State?: string
  Country?: string
  Pincode?: string
}

interface IndiaPostEntry {
  Message?: string
  Status?: string
  PostOffice?: IndiaPostOffice[] | null
}

async function lookupPincode(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)

  const pin = (request.params.pin || '').trim()

  if (!/^\d{6}$/.test(pin)) {
    return errorResponse('Pincode must be exactly 6 digits', 400, origin)
  }

  try {
    const upstream = await fetch(
      `https://api.postalpincode.in/pincode/${encodeURIComponent(pin)}`,
      {
        // 4-second timeout via AbortSignal - IndiaPost is usually <500ms
        // but during their occasional slow windows we'd rather degrade
        // than hang the customer's checkout.
        signal: AbortSignal.timeout(4000),
        headers: { Accept: 'application/json' },
      },
    )

    if (!upstream.ok) {
      context.warn(
        `lookupPincode: upstream ${upstream.status} for pin=${pin}`,
      )
      return errorResponse('Pincode service is temporarily unavailable', 502, origin)
    }

    const payload = (await upstream.json()) as unknown
    if (!Array.isArray(payload) || payload.length === 0) {
      return errorResponse('Pincode service returned unexpected data', 502, origin)
    }

    const entry = payload[0] as IndiaPostEntry
    const offices = Array.isArray(entry.PostOffice) ? entry.PostOffice : []
    if (entry.Status !== 'Success' || offices.length === 0) {
      // IndiaPost replies 200 + Status: "Error" when the PIN doesn't exist
      // - surface as 404 to the caller so the form can tell the user.
      return errorResponse('Pincode not found', 404, origin)
    }

    const po = offices[0]!

    return jsonResponse(
      {
        pincode: pin,
        // District is the right "city" for shipping in nearly all Indian
        // addresses. Fall back to Block then Name for the rare metro
        // sub-divisions where District is the whole metro area.
        city: po.District || po.Block || po.Name || '',
        district: po.District || '',
        state: po.State || '',
        country: po.Country || 'India',
      },
      200,
      // 24h - PIN-to-city mappings change so rarely we could cache for
      // weeks, but 24h is a safe trade-off against the (very rare) PIN
      // boundary change.
      { 'Cache-Control': 'public, max-age=86400' },
      origin,
    )
  } catch (err) {
    // AbortError → timeout. Network error → upstream down. Either way it's
    // a 502 from our perspective. Don't 500 - that would suggest our
    // service is broken; this is an upstream issue.
    const isAbort = err instanceof Error && err.name === 'AbortError'
    context.warn(
      `lookupPincode: ${isAbort ? 'timeout' : 'fetch failed'} for pin=${pin}`,
      err,
    )
    return errorResponse('Pincode service is temporarily unavailable', 502, origin)
  }
}

app.http('lookupPincode', {
  methods: ['GET', 'OPTIONS'],
  route: 'api/pincode/{pin}',
  authLevel: 'anonymous',
  handler: lookupPincode,
})
