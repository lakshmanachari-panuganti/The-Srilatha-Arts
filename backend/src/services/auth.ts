import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { TokenPayload } from '../types'

// Fail fast at module load - non-null assertion only catches TypeScript, not runtime.
// Without this, jwt.sign would throw a cryptic error on every request instead of at startup.
const JWT_SECRET = (() => {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('[auth] JWT_SECRET environment variable is required')
  return secret
})()
const COOKIE_NAME = 'tsa_token'

export function generateToken(payload: TokenPayload, isAdmin = false): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: isAdmin ? '24h' : '7d' })
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload
  } catch {
    return null
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function extractToken(authHeader?: string): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null
  return authHeader.slice(7)
}

export function extractTokenFromCookie(cookieHeader?: string | null): string | null {
  if (!cookieHeader) return null
  const cookies = cookieHeader.split(';').map((c) => c.trim())
  for (const c of cookies) {
    const [name, ...rest] = c.split('=')
    if (name === COOKIE_NAME) return decodeURIComponent(rest.join('='))
  }
  return null
}

// Host-only cookie: no Domain= attribute. The API and the SPA live on
// different registrable domains in prd (azurewebsites.net vs srilatha.art),
// so a Domain= attribute pinned to the SPA would be rejected by the browser
// per RFC 6265 §5.3.
//
// SameSite=None is required so the cookie is attached to cross-site fetches
// from the SPA origin - the SPA (SWA) and API (Function App) live on
// different registrable domains. Without None the browser refuses to send
// the auth cookie on any XHR from the SPA, and the frontend would have to
// fall back to a JS-readable token in localStorage - the XSS-exfiltration
// hole C1 exists to close. HttpOnly + Secure remain in force.
//
// Admin sessions omit Max-Age → the browser treats it as a *session cookie*
// and drops it when the browser closes. The JWT itself still expires after
// 24h server-side, so re-opening the browser inside that window still
// requires a fresh login. Customer sessions keep the 7-day Max-Age so
// shoppers stay signed in across browser restarts.
export function buildAuthCookie(token: string, isAdmin = false): string {
  const base = `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=None; Path=/`
  if (isAdmin) return base
  return `${base}; Max-Age=${7 * 24 * 60 * 60}`
}

export function buildClearCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0`
}
