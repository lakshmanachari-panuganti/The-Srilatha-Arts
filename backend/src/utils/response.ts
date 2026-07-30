import { HttpRequest, HttpResponseInit } from '@azure/functions'
import { createHash } from 'crypto'

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

export function corsHeaders(origin?: string | null): Record<string, string> {
  // Echo the request origin if it's in our allowlist, otherwise fall back to first allowed.
  // Allowing credentials requires a single explicit origin (not '*').
  const matched =
    origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || ''

  return {
    'Access-Control-Allow-Origin': matched,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
    'Access-Control-Expose-Headers': 'Set-Cookie',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  }
}

export function jsonResponse(
  data: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
  origin?: string | null,
): HttpResponseInit {
  return {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
      ...extraHeaders,
    },
    body: JSON.stringify(data),
  }
}

export function errorResponse(
  message: string,
  status = 400,
  origin?: string | null,
): HttpResponseInit {
  return jsonResponse({ error: message }, status, {}, origin)
}

export function corsPreflightResponse(origin?: string | null): HttpResponseInit {
  return { status: 204, headers: corsHeaders(origin) }
}

// ─── CONDITIONAL RESPONSES (ETag) ────────────────────────────
//
// Catalog reads were the hottest path in the API and shipped no cache
// headers at all, so every product-grid render, every PDP view and every
// bot crawl performed a full Table Storage read. These helpers turn a
// repeat read into a 304 with no storage transaction and no serialisation.
//
// NOTE for frontend callers: do NOT set If-None-Match by hand. The
// browser's HTTP cache revalidates automatically and hands fetch() a
// synthesised 200. A manual conditional request would surface a real 304,
// and `apiFetch` treats any non-2xx as an error.

/** Weak ETag over an already-serialised body. */
export function etagForBody(body: string): string {
  return `W/"${createHash('sha1').update(body).digest('base64url')}"`
}

/** Weak ETag over a response payload. */
export function etagFor(payload: unknown): string {
  return etagForBody(JSON.stringify(payload))
}

export function ifNoneMatch(request: HttpRequest): string | null {
  return request.headers.get('if-none-match')
}

export function notModified(
  etag: string,
  cacheControl: string,
  origin?: string | null,
): HttpResponseInit {
  return {
    status: 304,
    headers: {
      ...corsHeaders(origin),
      ETag: etag,
      'Cache-Control': cacheControl,
    },
  }
}

/**
 * JSON response with validation + freshness headers, short-circuiting to
 * 304 when the client already holds this exact payload.
 */
export function cacheableJsonResponse(
  request: HttpRequest,
  payload: unknown,
  cacheControl: string,
  origin?: string | null,
): HttpResponseInit {
  // Serialise once and reuse for both the ETag and the body. Going
  // through jsonResponse() would stringify the payload a second time —
  // wasteful on the hottest endpoint in the API, which is the one this
  // helper exists to make cheaper.
  const body = JSON.stringify(payload)
  const etag = etagForBody(body)

  if (ifNoneMatch(request) === etag) {
    return notModified(etag, cacheControl, origin)
  }

  return {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
      ETag: etag,
      'Cache-Control': cacheControl,
    },
    body,
  }
}

export function noContent(
  origin?: string | null,
  extraHeaders: Record<string, string> = {},
): HttpResponseInit {
  return { status: 204, headers: { ...corsHeaders(origin), ...extraHeaders } }
}
