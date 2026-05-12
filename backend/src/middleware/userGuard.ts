import { HttpRequest } from '@azure/functions'
import { extractToken, extractTokenFromCookie, verifyToken } from '../services/auth'

export interface UserContext {
  userId: string // email
}

export function requireUser(request: HttpRequest): UserContext | null {
  const authHeader = request.headers.get('authorization')
  const cookieHeader = request.headers.get('cookie')

  const token =
    extractTokenFromCookie(cookieHeader) || extractToken(authHeader || undefined)
  if (!token) return null

  const payload = verifyToken(token)
  if (!payload) return null
  if (payload.role !== 'customer') return null

  return { userId: payload.id }
}
