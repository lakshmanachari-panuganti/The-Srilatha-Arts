/**
 * User Auth Functions — register, login, Google OAuth.
 * Sets httpOnly cookie (§9) + returns token in body during V1 transition.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import {
  generateToken,
  hashPassword,
  comparePassword,
  buildAuthCookie,
  buildClearCookie,
} from '../services/auth'
import { getUser, getUserByGoogleId, createUser, updateUser } from '../services/tableStorage'
import { jsonResponse, errorResponse, corsPreflightResponse } from '../utils/response'
import { checkAndIncrement } from '../services/rateLimit'
import { OAuth2Client } from 'google-auth-library'

// No default fallback — validated at call time so Google sign-in can be disabled
// simply by not setting this env var rather than causing a startup failure.
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID

function getClientIp(request: HttpRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}

// ─── POST /api/auth/register ─────────────────────────────────

export async function userRegister(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)

  // Rate limit: 5 registration attempts per hour per IP
  const ip = getClientIp(request)
  const rateCheck = await checkAndIncrement(`register:${ip}`, 5, 3_600_000)
  if (!rateCheck.allowed) {
    return errorResponse('Too many registration attempts. Please try again later.', 429, origin)
  }

  try {
    const body = (await request.json()) as {
      name?: string
      email?: string
      phone?: string
      password?: string
    }

    if (!body.email || !body.password || !body.name) {
      return errorResponse('Name, email and password are required', 400, origin)
    }

    const email = body.email.toLowerCase().trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return errorResponse('Invalid email format', 400, origin)
    }

    const name = body.name.trim()
    if (name.length > 100) return errorResponse('Name must be 100 characters or less', 400, origin)
    if (body.password.length < 8) {
      return errorResponse('Password must be at least 8 characters', 400, origin)
    }
    if (body.password.length > 128) {
      return errorResponse('Password must be 128 characters or less', 400, origin)
    }
    if (body.phone && body.phone.trim().length > 20) {
      return errorResponse('Phone must be 20 characters or less', 400, origin)
    }

    const existing = await getUser(email)
    if (existing) {
      return errorResponse('An account with this email already exists', 409, origin)
    }

    const passwordHash = await hashPassword(body.password)
    const now = new Date().toISOString()

    await createUser({
      partitionKey: 'customer',
      rowKey: email,
      name,
      phone: body.phone?.trim() || '',
      passwordHash,
      authProvider: 'local',
      googleId: '',
      picture: '',
      isActive: true,
      createdAt: now,
      lastLogin: now,
    })

    const token = generateToken({ id: email, role: 'customer' })
    const cookie = buildAuthCookie(token)

    return jsonResponse(
      {
        user: { email, name, role: 'customer' },
        token, // V1 compat — drop in V2
      },
      201,
      { 'Set-Cookie': cookie },
      origin,
    )
  } catch (err: unknown) {
    const azErr = err as { statusCode?: number; code?: string }
    if (typeof azErr.statusCode === 'number') {
      if (azErr.statusCode === 403) {
        context.error('userRegister: Azure Table access denied — check RBAC / Managed Identity permissions', err)
        return errorResponse('Service configuration error — storage access denied. Please contact support.', 503, origin)
      }
      if (azErr.code === 'TableNotFound') {
        context.error('userRegister: "users" table does not exist in storage account', err)
        return errorResponse('Service configuration error — data store not found. Please contact support.', 503, origin)
      }
      context.error(`userRegister: Azure Table error (HTTP ${azErr.statusCode}, code=${azErr.code})`, err)
      return errorResponse('Service temporarily unavailable. Please try again in a moment.', 503, origin)
    }
    if (err instanceof SyntaxError) {
      return errorResponse('Invalid request body', 400, origin)
    }
    context.error('userRegister: unexpected error', err)
    return errorResponse('An unexpected error occurred. Please try again later.', 500, origin)
  }
}

// ─── POST /api/auth/login ────────────────────────────────────

export async function userLogin(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)

  // Rate limit: 10 attempts per 15 minutes per IP.
  // Applied to all login attempts (not just failures) to prevent credential-stuffing.
  const ip = getClientIp(request)
  const rateCheck = await checkAndIncrement(`login:${ip}`, 10, 15 * 60_000)
  if (!rateCheck.allowed) {
    return errorResponse('Too many login attempts. Please try again later.', 429, origin)
  }

  try {
    const body = (await request.json()) as {
      email?: string
      password?: string
    }

    if (!body.email || !body.password) {
      return errorResponse('Email and password are required', 400, origin)
    }

    const email = body.email.toLowerCase().trim()
    const user = await getUser(email)

    if (!user || user.isActive === false) {
      return errorResponse('Invalid email or password', 401, origin)
    }

    if (!user.passwordHash) {
      return errorResponse(
        'This account uses Google sign-in. Please use the Google button.',
        400,
        origin,
      )
    }

    const valid = await comparePassword(body.password, user.passwordHash)
    if (!valid) {
      return errorResponse('Invalid email or password', 401, origin)
    }

    // Update last login
    await updateUser({ ...user, lastLogin: new Date().toISOString() })

    const token = generateToken({ id: email, role: 'customer' })
    const cookie = buildAuthCookie(token)

    return jsonResponse(
      {
        user: {
          email: user.rowKey,
          name: user.name,
          phone: user.phone || undefined,
          picture: user.picture || undefined,
          role: 'customer',
        },
        token,
      },
      200,
      { 'Set-Cookie': cookie },
      origin,
    )
  } catch (err: unknown) {
    const azErr = err as { statusCode?: number; code?: string }
    if (typeof azErr.statusCode === 'number') {
      if (azErr.statusCode === 403) {
        context.error('userLogin: Azure Table access denied — check RBAC / Managed Identity permissions', err)
        return errorResponse('Service configuration error — storage access denied. Please contact support.', 503, origin)
      }
      if (azErr.code === 'TableNotFound') {
        context.error('userLogin: "users" table does not exist in storage account', err)
        return errorResponse('Service configuration error — data store not found. Please contact support.', 503, origin)
      }
      context.error(`userLogin: Azure Table error (HTTP ${azErr.statusCode}, code=${azErr.code})`, err)
      return errorResponse('Service temporarily unavailable. Please try again in a moment.', 503, origin)
    }
    if (err instanceof SyntaxError) {
      return errorResponse('Invalid request body', 400, origin)
    }
    context.error('userLogin: unexpected error', err)
    return errorResponse('An unexpected error occurred. Please try again later.', 500, origin)
  }
}

// ─── POST /api/auth/google ───────────────────────────────────

export async function googleAuth(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)

  // Rate limit: 10 attempts per 15 minutes per IP.
  const ip = getClientIp(request)
  const rateCheck = await checkAndIncrement(`google_auth:${ip}`, 10, 15 * 60_000)
  if (!rateCheck.allowed) {
    return errorResponse('Too many attempts. Please try again later.', 429, origin)
  }

  if (!GOOGLE_CLIENT_ID) {
    context.error('googleAuth: GOOGLE_CLIENT_ID is not configured — set env var to enable Google sign-in')
    return errorResponse('Google sign-in is not available. Please use email/password login.', 503, origin)
  }

  try {
    const body = (await request.json()) as { credential?: string }
    if (!body.credential) {
      return errorResponse('Google credential is required', 400, origin)
    }

    const client = new OAuth2Client(GOOGLE_CLIENT_ID)
    const ticket = await client.verifyIdToken({
      idToken: body.credential,
      audience: GOOGLE_CLIENT_ID,
    })

    const payload = ticket.getPayload()
    if (!payload || !payload.email) {
      return errorResponse('Invalid Google credential', 401, origin)
    }

    const email = payload.email.toLowerCase()
    const name = payload.name || email.split('@')[0]
    const picture = payload.picture || ''
    const googleId = payload.sub

    let user = await getUser(email)

    if (user) {
      // Update Google info + last login
      await updateUser({
        ...user,
        googleId: googleId || user.googleId,
        picture: picture || user.picture,
        name: user.name || name,
        lastLogin: new Date().toISOString(),
      })
    } else {
      // Check by Google ID (user may have changed email)
      user = await getUserByGoogleId(googleId)
      if (user) {
        await updateUser({
          ...user,
          lastLogin: new Date().toISOString(),
        })
      } else {
        // New user
        const now = new Date().toISOString()
        await createUser({
          partitionKey: 'customer',
          rowKey: email,
          name,
          phone: '',
          passwordHash: '',
          authProvider: 'google',
          googleId,
          picture,
          isActive: true,
          createdAt: now,
          lastLogin: now,
        })
      }
    }

    const token = generateToken({
      id: user?.rowKey || email,
      role: 'customer',
    })
    const cookie = buildAuthCookie(token)

    return jsonResponse(
      {
        user: {
          email: user?.rowKey || email,
          name: user?.name || name,
          picture: user?.picture || picture,
          role: 'customer',
        },
        token,
      },
      200,
      { 'Set-Cookie': cookie },
      origin,
    )
  } catch (err: unknown) {
    const azErr = err as { statusCode?: number; code?: string }
    if (typeof azErr.statusCode === 'number') {
      if (azErr.statusCode === 403) {
        context.error('googleAuth: Azure Table access denied — check RBAC / Managed Identity permissions', err)
        return errorResponse('Service configuration error — storage access denied. Please contact support.', 503, origin)
      }
      if (azErr.code === 'TableNotFound') {
        context.error('googleAuth: "users" table does not exist in storage account', err)
        return errorResponse('Service configuration error — data store not found. Please contact support.', 503, origin)
      }
      context.error(`googleAuth: Azure Table error (HTTP ${azErr.statusCode}, code=${azErr.code})`, err)
      return errorResponse('Service temporarily unavailable. Please try again in a moment.', 503, origin)
    }
    if (err instanceof SyntaxError) {
      return errorResponse('Invalid request body', 400, origin)
    }
    context.error('googleAuth: unexpected error', err)
    return errorResponse('Google authentication failed. Please try again later.', 500, origin)
  }
}

// ─── Route registrations ─────────────────────────────────────

app.http('userRegister', {
  methods: ['POST', 'OPTIONS'],
  route: 'api/auth/register',
  authLevel: 'anonymous',
  handler: userRegister,
})

app.http('userLogin', {
  methods: ['POST', 'OPTIONS'],
  route: 'api/auth/login',
  authLevel: 'anonymous',
  handler: userLogin,
})

app.http('googleAuth', {
  methods: ['POST', 'OPTIONS'],
  route: 'api/auth/google',
  authLevel: 'anonymous',
  handler: googleAuth,
})

// ─── POST /api/auth/logout ───────────────────────────────────
// Clears the httpOnly tsa_token cookie. No auth required — clearing an
// already-expired or missing cookie is harmless.

export async function userLogout(
  request: HttpRequest,
  _context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)
  return jsonResponse({ ok: true }, 200, { 'Set-Cookie': buildClearCookie() }, origin)
}

app.http('userLogout', {
  methods: ['POST', 'OPTIONS'],
  route: 'api/auth/logout',
  authLevel: 'anonymous',
  handler: userLogout,
})
