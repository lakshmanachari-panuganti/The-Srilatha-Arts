import { HttpResponseInit } from '@azure/functions'

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

function corsHeaders(origin?: string | null): Record<string, string> {
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

export function noContent(
  origin?: string | null,
  extraHeaders: Record<string, string> = {},
): HttpResponseInit {
  return { status: 204, headers: { ...corsHeaders(origin), ...extraHeaders } }
}
