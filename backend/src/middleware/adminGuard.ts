import { HttpRequest } from '@azure/functions'
import { extractToken, extractTokenFromCookie, verifyToken } from '../services/auth'

export interface AdminContext {
  adminId: string
  role: 'admin' | 'superadmin'
}

export function requireAdmin(request: HttpRequest): AdminContext | null {
  const authHeader = request.headers.get('authorization')
  const cookieHeader = request.headers.get('cookie')

  const token =
    extractTokenFromCookie(cookieHeader) || extractToken(authHeader || undefined)
  if (!token) return null

  const payload = verifyToken(token)
  if (!payload) return null
  if (payload.role !== 'admin' && payload.role !== 'superadmin') return null

  return { adminId: payload.id, role: payload.role as 'admin' | 'superadmin' }
}

export function requireSuperAdmin(request: HttpRequest): AdminContext | null {
  const admin = requireAdmin(request)
  if (!admin || admin.role !== 'superadmin') return null
  return admin
}
