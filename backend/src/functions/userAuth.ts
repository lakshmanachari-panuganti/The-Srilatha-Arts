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
} from '../services/auth'
import { getUser, getUserByGoogleId, createUser, updateUser } from '../services/tableStorage'
import { jsonResponse, errorResponse, corsPreflightResponse } from '../utils/response'
import { OAuth2Client } from 'google-auth-library'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''

// ─── POST /api/auth/register ─────────────────────────────────

export async function userRegister(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)

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
    if (body.password.length < 8) {
      return errorResponse('Password must be at least 8 characters', 400, origin)
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
      name: body.name.trim(),
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
        user: { email, name: body.name.trim(), role: 'customer' },
        token, // V1 compat — drop in V2
      },
      201,
      { 'Set-Cookie': cookie },
      origin,
    )
  } catch (err) {
    context.error('userRegister failed', err)
    return errorResponse('Registration failed', 500, origin)
  }
}

// ─── POST /api/auth/login ────────────────────────────────────

export async function userLogin(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)

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
  } catch (err) {
    context.error('userLogin failed', err)
    return errorResponse('Login failed', 500, origin)
  }
}

// ─── POST /api/auth/google ───────────────────────────────────

export async function googleAuth(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)

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
  } catch (err) {
    context.error('googleAuth failed', err)
    return errorResponse('Google authentication failed', 500, origin)
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
