/**
 * Admin Auth Function - admin login.
 * Sets httpOnly cookie with shorter TTL (24h).
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import {
  generateToken,
  comparePassword,
  hashPassword,
  buildAuthCookie,
  buildClearCookie,
} from '../services/auth'
import { getAdmin, updateAdmin, getAllAdmins, createAdmin } from '../services/tableStorage'
import { jsonResponse, errorResponse, corsPreflightResponse } from '../utils/response'
import { checkAndIncrement } from '../services/rateLimit'
import { getClientIp } from '../utils/clientIp'

// ─── POST /api/auth/admin/login ──────────────────────────────

export async function adminLogin(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)

  // Rate limit: 10 attempts per 15 minutes per IP. Admin login is a
  // high-value target so we cap it tighter than the public login path.
  const ip = getClientIp(request)
  const rateCheck = await checkAndIncrement(`admin_login:${ip}`, 10, 15 * 60_000)
  if (!rateCheck.allowed) {
    return errorResponse('Too many attempts. Please try again later.', 429, origin)
  }

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
  } catch (err: unknown) {
    // ── Azure Table Storage errors (RestError from @azure/data-tables) ──
    const azErr = err as { statusCode?: number; code?: string; message?: string }
    if (typeof azErr.statusCode === 'number') {
      if (azErr.statusCode === 403) {
        context.error('adminLogin: Azure Table access denied - check RBAC / Managed Identity permissions', err)
        return errorResponse(
          'Service configuration error - storage access denied. Please contact support.',
          503,
          origin,
        )
      }
      if (azErr.code === 'TableNotFound') {
        context.error('adminLogin: "admins" table does not exist in storage account', err)
        return errorResponse(
          'Service configuration error - admin data store not found. Please contact support.',
          503,
          origin,
        )
      }
      context.error(`adminLogin: Azure Table error (HTTP ${azErr.statusCode}, code=${azErr.code})`, err)
      return errorResponse(
        'Service temporarily unavailable. Please try again in a moment.',
        503,
        origin,
      )
    }

    // ── JSON parse failure (malformed request body) ──
    if (err instanceof SyntaxError) {
      return errorResponse('Invalid request body', 400, origin)
    }

    // ── Unexpected / unknown errors ──
    context.error('adminLogin: unexpected error', err)
    return errorResponse('An unexpected error occurred. Please try again later.', 500, origin)
  }
}

app.http('adminLogin', {
  methods: ['POST', 'OPTIONS'],
  route: 'api/auth/admin/login',
  authLevel: 'anonymous',
  handler: adminLogin,
})

// ─── POST /api/auth/admin/logout ─────────────────────────────
// Clears the httpOnly tsa_token cookie. No body required.

export async function adminLogout(
  request: HttpRequest,
  _context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)
  return jsonResponse({ ok: true }, 200, { 'Set-Cookie': buildClearCookie() }, origin)
}

app.http('adminLogout', {
  methods: ['POST', 'OPTIONS'],
  route: 'api/auth/admin/logout',
  authLevel: 'anonymous',
  handler: adminLogout,
})

// ─── POST /api/auth/admin/setup ───────────────────────────────
// One-time bootstrap: creates the first admin account.
// Returns 403 if any admin already exists.

export async function adminSetup(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)

  try {
    // Refuse if admins already exist
    const existing = await getAllAdmins()
    if (existing.length > 0) {
      return errorResponse('Setup already completed', 403, origin)
    }

    const body = (await request.json()) as {
      username?: string
      password?: string
      name?: string
      setupKey?: string
    }

    // Require a setup key to prevent accidental/malicious invocation
    const expectedKey = process.env.ADMIN_SETUP_KEY
    if (!expectedKey || body.setupKey !== expectedKey) {
      return errorResponse('Invalid setup key', 403, origin)
    }

    if (!body.username || !body.password) {
      return errorResponse('username and password are required', 400, origin)
    }

    const username = body.username.toLowerCase().trim()
    const passwordHash = await hashPassword(body.password)

    await createAdmin({
      partitionKey: 'admin',
      rowKey: username,
      name: body.name ?? username,
      role: 'superadmin',
      passwordHash,
      isActive: true,
      createdAt: new Date().toISOString(),
    })

    context.log(`adminSetup: created first admin "${username}"`)
    return jsonResponse({ ok: true, username }, 201, {}, origin)
  } catch (err: unknown) {
    context.error('adminSetup: unexpected error', err)
    return errorResponse('Setup failed', 500, origin)
  }
}

app.http('adminSetup', {
  methods: ['POST', 'OPTIONS'],
  route: 'api/auth/admin/setup',
  authLevel: 'anonymous',
  handler: adminSetup,
})
