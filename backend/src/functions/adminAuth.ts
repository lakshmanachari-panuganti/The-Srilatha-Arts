/**
 * Admin Auth Function — admin login.
 * Sets httpOnly cookie with shorter TTL (24h).
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import {
  generateToken,
  comparePassword,
  buildAuthCookie,
} from '../services/auth'
import { getAdmin, updateAdmin } from '../services/tableStorage'
import { jsonResponse, errorResponse, corsPreflightResponse } from '../utils/response'

// ─── POST /api/auth/admin/login ──────────────────────────────

export async function adminLogin(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)

  try {
    const body = (await request.json()) as {
      username?: string
      password?: string
    }

    if (!body.username || !body.password) {
      return errorResponse('Username and password are required', 400, origin)
    }

    const username = body.username.toLowerCase().trim()
    const admin = await getAdmin(username)

    if (!admin || admin.isActive === false) {
      return errorResponse('Invalid credentials', 401, origin)
    }

    const valid = await comparePassword(body.password, admin.passwordHash)
    if (!valid) {
      return errorResponse('Invalid credentials', 401, origin)
    }

    // Update last login
    await updateAdmin({ ...admin, lastLogin: new Date().toISOString() })

    const role = admin.role === 'superadmin' ? 'superadmin' : 'admin'
    const token = generateToken({ id: username, role }, true)
    const cookie = buildAuthCookie(token, true)

    return jsonResponse(
      {
        user: {
          username: admin.rowKey,
          name: admin.name,
          role: admin.role,
        },
        token,
      },
      200,
      { 'Set-Cookie': cookie },
      origin,
    )
  } catch (err) {
    context.error('adminLogin failed', err)
    return errorResponse('Login failed', 500, origin)
  }
}

app.http('adminLogin', {
  methods: ['POST', 'OPTIONS'],
  route: 'api/auth/admin/login',
  authLevel: 'anonymous',
  handler: adminLogin,
})
