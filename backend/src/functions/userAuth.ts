/**
 * User Auth Functions - register, login, Google OAuth.
 * Sets httpOnly cookie (§9) + returns token in body during V1 transition.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import crypto from 'crypto'
import {
  generateToken,
  hashPassword,
  comparePassword,
  buildAuthCookie,
  extractToken,
  extractTokenFromCookie,
  verifyToken,
} from '../services/auth'
import { getUser, getUserByGoogleId, createUser, updateUser } from '../services/tableStorage'
import { jsonResponse, errorResponse, corsPreflightResponse } from '../utils/response'
import { checkAndIncrement, resetRateLimit } from '../services/rateLimit'
import { OAuth2Client } from 'google-auth-library'
import { enforceCsrf } from '../middleware/csrfGuard'
import { getClientIp } from '../utils/clientIp'
import { sendVerificationOtp } from '../services/otpSender'
import { sendEmail, isEmailConfigured } from '../services/email'

// No default fallback - validated at call time so Google sign-in can be disabled
// simply by not setting this env var rather than causing a startup failure.
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID

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
        token, // V1 compat - drop in V2
      },
      201,
      { 'Set-Cookie': cookie },
      origin,
    )
  } catch (err: unknown) {
    const azErr = err as { statusCode?: number; code?: string }
    if (typeof azErr.statusCode === 'number') {
      if (azErr.statusCode === 403) {
        context.error('userRegister: Azure Table access denied - check RBAC / Managed Identity permissions', err)
        return errorResponse('Service configuration error - storage access denied. Please contact support.', 503, origin)
      }
      if (azErr.code === 'TableNotFound') {
        context.error('userRegister: "users" table does not exist in storage account', err)
        return errorResponse('Service configuration error - data store not found. Please contact support.', 503, origin)
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

    // Per-account lockout (audit H1). Second counter keyed on the account,
    // not the IP, so a distributed / rotating-IP credential-stuffing attack
    // can't get more than 10 guesses per hour per email regardless of how
    // many source IPs it uses. Successful login clears the counter.
    const accountLockKey = `login_fail:${email}`
    const accountCheck = await checkAndIncrement(accountLockKey, 10, 60 * 60_000)
    if (!accountCheck.allowed) {
      return errorResponse(
        'This account has been temporarily locked after too many failed attempts. Please try again later.',
        429,
        origin,
      )
    }

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

    // Success — clear the per-account counter so future logins after some
    // sporadic failures don't hit an unexpected 429.
    await resetRateLimit(accountLockKey)

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
        context.error('userLogin: Azure Table access denied - check RBAC / Managed Identity permissions', err)
        return errorResponse('Service configuration error - storage access denied. Please contact support.', 503, origin)
      }
      if (azErr.code === 'TableNotFound') {
        context.error('userLogin: "users" table does not exist in storage account', err)
        return errorResponse('Service configuration error - data store not found. Please contact support.', 503, origin)
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
    context.error('googleAuth: GOOGLE_CLIENT_ID is not configured - set env var to enable Google sign-in')
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
          profileComplete: false,
          createdAt: now,
          lastLogin: now,
        })
      }
    }

    // Reload the user after create/update so we have the latest state
    const finalUser = (await getUser(user?.rowKey || email)) ?? { rowKey: email, name, picture, phone: '' }
    const needsProfileSetup = !finalUser.profileComplete

    const token = generateToken({
      id: finalUser.rowKey || email,
      role: 'customer',
    })
    const cookie = buildAuthCookie(token)

    return jsonResponse(
      {
        user: {
          email: finalUser.rowKey || email,
          name: finalUser.name || name,
          picture: finalUser.picture || picture,
          phone: finalUser.phone || undefined,
          role: 'customer',
        },
        token,
        needsProfileSetup,
      },
      200,
      { 'Set-Cookie': cookie },
      origin,
    )
  } catch (err: unknown) {
    const azErr = err as { statusCode?: number; code?: string }
    if (typeof azErr.statusCode === 'number') {
      if (azErr.statusCode === 403) {
        context.error('googleAuth: Azure Table access denied - check RBAC / Managed Identity permissions', err)
        return errorResponse('Service configuration error - storage access denied. Please contact support.', 503, origin)
      }
      if (azErr.code === 'TableNotFound') {
        context.error('googleAuth: "users" table does not exist in storage account', err)
        return errorResponse('Service configuration error - data store not found. Please contact support.', 503, origin)
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

// POST /api/auth/logout is registered in auth.ts (`authLogout`). A second
// registration here used to win or lose the route race on host startup,
// emitting `The 'userLogout' function is in error: The route specified
// conflicts with the route defined by function 'authLogout'.`

// ─── PATCH /api/auth/profile ─────────────────────────────────
// Lets a Google-authenticated user set their display name and phone after
// first sign-in. Sets profileComplete = true so the modal is not shown again.

export async function updateProfile(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)
  const csrfFail = enforceCsrf(request, origin)
  if (csrfFail) return csrfFail

  const cookieHeader = request.headers.get('cookie')
  const authHeader = request.headers.get('authorization')
  const token =
    extractTokenFromCookie(cookieHeader) || extractToken(authHeader || undefined)

  if (!token) return errorResponse('Authentication required', 401, origin)

  const payload = verifyToken(token)
  if (!payload || payload.role !== 'customer') {
    return errorResponse('Authentication required', 401, origin)
  }

  try {
    const body = (await request.json()) as { name?: string; phone?: string }

    if (!body.name || !body.name.trim()) {
      return errorResponse('Full name is required', 400, origin)
    }

    const name = body.name.trim()
    if (name.length > 100) return errorResponse('Name must be 100 characters or less', 400, origin)

    const phone = body.phone?.trim() || ''
    if (phone && phone.length > 20) return errorResponse('Phone must be 20 characters or less', 400, origin)

    const user = await getUser(payload.id)
    if (!user || user.isActive === false) {
      return errorResponse('User not found', 404, origin)
    }

    await updateUser({
      ...user,
      name,
      phone,
      profileComplete: true,
    })

    return jsonResponse(
      {
        user: {
          email: user.rowKey,
          name,
          phone: phone || undefined,
          picture: user.picture || undefined,
          role: 'customer',
        },
      },
      200,
      {},
      origin,
    )
  } catch (err: unknown) {
    const azErr = err as { statusCode?: number; code?: string }
    if (typeof azErr.statusCode === 'number') {
      context.error(`updateProfile: Azure Table error (HTTP ${azErr.statusCode})`, err)
      return errorResponse('Service temporarily unavailable. Please try again.', 503, origin)
    }
    if (err instanceof SyntaxError) {
      return errorResponse('Invalid request body', 400, origin)
    }
    context.error('updateProfile: unexpected error', err)
    return errorResponse('Failed to update profile. Please try again.', 500, origin)
  }
}

app.http('updateProfile', {
  methods: ['PATCH', 'OPTIONS'],
  route: 'api/auth/profile',
  authLevel: 'anonymous',
  handler: updateProfile,
})

// ─── POST /api/auth/forgot-password ──────────────────────────

export async function forgotPassword(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)

  const ip = getClientIp(request)
  const rateCheck = await checkAndIncrement(`forgot_pw:${ip}`, 3, 3_600_000)
  if (!rateCheck.allowed) {
    return errorResponse('Too many requests. Please try again later.', 429, origin)
  }

  try {
    const body = (await request.json()) as { email?: string }

    if (!body.email) {
      return errorResponse('Email is required', 400, origin)
    }

    const email = body.email.toLowerCase().trim()
    const user = await getUser(email)

    // Non-existent or Google-only accounts get a generic 200 to prevent enumeration
    if (!user || user.isActive === false || !user.passwordHash) {
      return jsonResponse(
        { message: 'If a matching account exists, a verification code has been sent.' },
        200, {}, origin,
      )
    }

    const otp = crypto.randomInt(100_000, 1_000_000).toString()
    const otpHash = await hashPassword(otp)
    const expiry = new Date(Date.now() + 10 * 60_000).toISOString()

    await updateUser({ ...user, resetOtpHash: otpHash, resetOtpExpiry: expiry })

    // Build OTP email
    const otpEmailHtml = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0B1120;font-family:'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0B1120;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#111827;border-radius:12px;border:1px solid rgba(255,255,255,0.08);padding:40px 32px">
        <tr><td>
          <h1 style="margin:0 0 8px;font-size:24px;color:#f8fafc;font-weight:600">Srilatha Art</h1>
          <p style="margin:0 0 24px;font-size:14px;color:#94a3b8">Password reset verification</p>
          <p style="margin:0 0 8px;font-size:14px;color:#cbd5e1">Your one-time verification code is:</p>
          <div style="margin:16px 0;padding:20px;background:#0B1120;border-radius:8px;border:1px solid rgba(59,130,246,0.3);text-align:center">
            <span style="font-size:36px;font-weight:700;letter-spacing:0.3em;color:#3B82F6">${otp}</span>
          </div>
          <p style="margin:0 0 24px;font-size:13px;color:#64748b">This code expires in <strong style="color:#94a3b8">10 minutes</strong>. If you did not request a password reset, you can safely ignore this email.</p>
          <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:24px 0">
          <p style="margin:0;font-size:12px;color:#475569">Srilatha Art · Hyderabad, Telangana, India</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

    const otpEmailText = `Your Srilatha Art verification code: ${otp}\n\nThis code expires in 10 minutes. If you did not request a password reset, you can safely ignore this email.`

    // Send via both channels in parallel; require at least one to succeed
    const [emailResult, waResult] = await Promise.allSettled([
      isEmailConfigured()
        ? sendEmail({ to: email, subject: 'Your Srilatha Art verification code', html: otpEmailHtml, text: otpEmailText })
        : Promise.reject(new Error('Email not configured')),
      user.phone
        ? sendVerificationOtp(user.phone, otp)
        : Promise.reject(new Error('No phone on account')),
    ])

    if (emailResult.status === 'rejected') {
      context.error('forgotPassword: email send failed', emailResult.reason)
    }
    const waError = waResult.status === 'rejected'
      ? (waResult.reason instanceof Error ? waResult.reason.message : String(waResult.reason))
      : null
    if (waError && user.phone) {
      context.error('forgotPassword: WhatsApp send failed', waError)
    }

    const channels: string[] = []
    if (emailResult.status === 'fulfilled') channels.push('email')
    if (waResult.status === 'fulfilled') channels.push('whatsapp')

    if (channels.length === 0) {
      return errorResponse('Failed to send verification code. Please try again.', 503, origin)
    }

    // Mask email: th****si@gmail.com
    const [localPart, domain] = email.split('@')
    const visibleChars = 2
    const maskedLocal = localPart.length <= visibleChars * 2
      ? '*'.repeat(localPart.length)
      : `${localPart.slice(0, visibleChars)}${'*'.repeat(localPart.length - visibleChars * 2)}${localPart.slice(-visibleChars)}`
    const maskedEmail = `${maskedLocal}@${domain}`

    // Mask phone: 9014***38 (last 10 digits, first 4 visible, last 2 visible)
    let maskedPhone: string | undefined
    if (waResult.status === 'fulfilled' && user.phone) {
      const digits = user.phone.replace(/\D/g, '')
      const local10 = digits.slice(-10)
      maskedPhone = `${local10.slice(0, 4)}${'*'.repeat(local10.length - 6)}${local10.slice(-2)}`
    }

    // _debug is temporary — lets us read the exact Meta/WA error from the
    // browser Network tab without needing portal log access. Remove once stable.
    const _debug: Record<string, unknown> = {
      phoneOnAccount: Boolean(user.phone),
      waAttempted: Boolean(user.phone),
    }
    if (waError) _debug.waError = waError

    return jsonResponse(
      { message: 'Verification code sent.', channels, email: maskedEmail, phone: maskedPhone, _debug },
      200, {}, origin,
    )
  } catch (err: unknown) {
    const azErr = err as { statusCode?: number; code?: string }
    if (typeof azErr.statusCode === 'number') {
      context.error(`forgotPassword: Azure Table error (HTTP ${azErr.statusCode})`, err)
      return errorResponse('Service temporarily unavailable. Please try again.', 503, origin)
    }
    if (err instanceof SyntaxError) {
      return errorResponse('Invalid request body', 400, origin)
    }
    context.error('forgotPassword: unexpected error', err)
    return errorResponse('An unexpected error occurred. Please try again later.', 500, origin)
  }
}

app.http('forgotPassword', {
  methods: ['POST', 'OPTIONS'],
  route: 'api/auth/forgot-password',
  authLevel: 'anonymous',
  handler: forgotPassword,
})

// ─── POST /api/auth/reset-password ───────────────────────────

export async function resetPassword(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)

  const ip = getClientIp(request)
  const rateCheck = await checkAndIncrement(`reset_pw:${ip}`, 5, 15 * 60_000)
  if (!rateCheck.allowed) {
    return errorResponse('Too many attempts. Please try again later.', 429, origin)
  }

  try {
    const body = (await request.json()) as { email?: string; otp?: string; newPassword?: string }

    if (!body.email || !body.otp || !body.newPassword) {
      return errorResponse('Email, verification code and new password are required', 400, origin)
    }

    const email = body.email.toLowerCase().trim()
    const otp = body.otp.trim()

    if (body.newPassword.length < 8) {
      return errorResponse('Password must be at least 8 characters', 400, origin)
    }
    if (body.newPassword.length > 128) {
      return errorResponse('Password must be 128 characters or less', 400, origin)
    }

    const user = await getUser(email)

    if (!user || user.isActive === false || !user.passwordHash) {
      return errorResponse('Invalid or expired verification code.', 400, origin)
    }

    if (!user.resetOtpHash || !user.resetOtpExpiry) {
      return errorResponse('No verification code was requested. Please request a new one.', 400, origin)
    }

    if (new Date(user.resetOtpExpiry) <= new Date()) {
      await updateUser({ ...user, resetOtpHash: undefined, resetOtpExpiry: undefined })
      return errorResponse('Verification code has expired. Please request a new one.', 400, origin)
    }

    const valid = await comparePassword(otp, user.resetOtpHash)
    if (!valid) {
      return errorResponse('Invalid verification code.', 400, origin)
    }

    const newPasswordHash = await hashPassword(body.newPassword)
    await updateUser({
      ...user,
      passwordHash: newPasswordHash,
      resetOtpHash: undefined,
      resetOtpExpiry: undefined,
    })

    return jsonResponse({ message: 'Password reset successfully.' }, 200, {}, origin)
  } catch (err: unknown) {
    const azErr = err as { statusCode?: number; code?: string }
    if (typeof azErr.statusCode === 'number') {
      context.error(`resetPassword: Azure Table error (HTTP ${azErr.statusCode})`, err)
      return errorResponse('Service temporarily unavailable. Please try again.', 503, origin)
    }
    if (err instanceof SyntaxError) {
      return errorResponse('Invalid request body', 400, origin)
    }
    context.error('resetPassword: unexpected error', err)
    return errorResponse('An unexpected error occurred. Please try again later.', 500, origin)
  }
}

app.http('resetPassword', {
  methods: ['POST', 'OPTIONS'],
  route: 'api/auth/reset-password',
  authLevel: 'anonymous',
  handler: resetPassword,
})
