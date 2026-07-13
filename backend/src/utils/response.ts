import { HttpResponseInit } from '@azure/functions'

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

export function corsHeaders(origin?: string | null): Record<string, string> {
  // Echo the request origin only when it's in our allowlist. Allowing
  // credentials requires a single explicit origin (not '*'). Unknown or
  // absent origins get NO Allow-Origin/Allow-Credentials at all - the
  // browser's same-origin policy then blocks the cross-origin read.
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
    'Access-Control-Expose-Headers': 'Set-Cookie',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  }

  if (origin && allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Credentials'] = 'true'
  }

  return headers
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
