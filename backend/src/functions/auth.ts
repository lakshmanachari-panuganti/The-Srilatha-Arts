import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import {
  extractToken,
  extractTokenFromCookie,
  verifyToken,
  buildClearCookie,
} from '../services/auth'
import { getUser, getAdmin } from '../services/tableStorage'
import { jsonResponse, errorResponse, corsPreflightResponse } from '../utils/response'
import { generateCsrfToken, buildCsrfCookie } from '../services/csrf'

// GET /api/auth/me  - hydrates the current session for the SPA
export async function authMe(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)

  const cookieHeader = request.headers.get('cookie')
  const authHeader = request.headers.get('authorization')
  const token =
    extractTokenFromCookie(cookieHeader) || extractToken(authHeader || undefined)

  if (!token) return jsonResponse({ user: null }, 200, {}, origin)

  const payload = verifyToken(token)
  if (!payload) return jsonResponse({ user: null }, 200, {}, origin)

  try {
    if (payload.role === 'customer') {
      const row = await getUser(payload.id)
      if (!row || row.isActive === false) {
        return jsonResponse({ user: null }, 200, {}, origin)
      }
      return jsonResponse(
        {
          user: {
            email: row.rowKey,
            name: row.name,
            phone: row.phone || undefined,
            picture: row.picture || undefined,
            role: 'customer',
          },
        },
        200,
        {},
        origin,
      )
    }

    if (payload.role === 'admin' || payload.role === 'superadmin') {
      const row = await getAdmin(payload.id)
      if (!row || row.isActive === false) {
        return jsonResponse({ user: null }, 200, {}, origin)
      }
      return jsonResponse(
        {
          user: {
            email: row.rowKey,
            name: row.name,
            role: row.role,
          },
        },
        200,
        {},
        origin,
      )
    }

    return jsonResponse({ user: null }, 200, {}, origin)
  } catch (err) {
    context.error('authMe failed', err)
    return errorResponse('Failed to load session', 500, origin)
  }
}

// POST /api/auth/logout - clears the auth cookie
export async function authLogout(
  request: HttpRequest,
  _context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)

  return jsonResponse(
    { ok: true },
    200,
    { 'Set-Cookie': buildClearCookie() },
    origin,
  )
}

// GET /api/auth/csrf - issues CSRF token cookie + JSON value
export async function authCsrf(
  request: HttpRequest,
  _context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)

  const token = generateCsrfToken()
  return jsonResponse(
    { csrfToken: token },
    200,
    { 'Set-Cookie': buildCsrfCookie(token) },
    origin,
  )
}

app.http('authMe', {
  methods: ['GET', 'OPTIONS'],
  route: 'api/auth/me',
  authLevel: 'anonymous',
  handler: authMe,
})

app.http('authLogout', {
  methods: ['POST', 'OPTIONS'],
  route: 'api/auth/logout',
  authLevel: 'anonymous',
  handler: authLogout,
})

app.http('authCsrf', {
  methods: ['GET', 'OPTIONS'],
  route: 'api/auth/csrf',
  authLevel: 'anonymous',
  handler: authCsrf,
})
