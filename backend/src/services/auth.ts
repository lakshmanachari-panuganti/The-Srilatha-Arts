import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { TokenPayload } from '../types'

const JWT_SECRET = process.env.JWT_SECRET!
const COOKIE_NAME = 'tsa_token'
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || ''

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

export function buildAuthCookie(token: string, isAdmin = false): string {
  const maxAge = isAdmin ? 24 * 60 * 60 : 7 * 24 * 60 * 60
  const domain = COOKIE_DOMAIN ? `; Domain=${COOKIE_DOMAIN}` : ''
  // SameSite=Lax keeps the cookie attached for top-level navigations,
  // Secure is required by browsers for SameSite=None and recommended otherwise.
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}${domain}`
}

export function buildClearCookie(): string {
  const domain = COOKIE_DOMAIN ? `; Domain=${COOKIE_DOMAIN}` : ''
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0${domain}`
}
