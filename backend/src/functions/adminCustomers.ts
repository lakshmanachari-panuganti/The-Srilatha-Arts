/**
 * Admin Customers Endpoint.
 *
 * GET /api/admin/customers - list registered customers (Google + email/password
 * sign-ups), enriched with aggregate order stats per customer.
 *
 * Source: the `users` table holds every account (PartitionKey = "customer").
 * We join in counts/totals from `orders` to surface "X orders, ₹Y spent,
 * last order on Z" without forcing the admin UI to make N follow-up calls.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { getAllUsers, getAllOrders, Row } from '../services/tableStorage'
import { requireAdmin } from '../middleware/adminGuard'
import { jsonResponse, errorResponse, corsPreflightResponse } from '../utils/response'

interface CustomerView {
  id: string
  email: string
  name: string
  phone?: string
  picture?: string
  authProvider: 'google' | 'local' | 'unknown'
  createdAt?: string
  lastLogin?: string
  orderCount: number
  totalSpent: number
  lastOrder?: string
}

async function adminListCustomers(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)

  const admin = requireAdmin(request)
  if (!admin) return errorResponse('Unauthorized', 401, origin)

  try {
    const q = request.query.get('q')?.toLowerCase().trim() || ''

    const [users, orders] = await Promise.all([
      getAllUsers(),
      getAllOrders().catch(() => [] as Row[]),
    ])

    // Aggregate order stats by customer email (orders.PartitionKey).
    const statsByEmail = new Map<
      string,
      { orderCount: number; totalSpent: number; lastOrder?: string }
    >()
    for (const o of orders) {
      const email = (o.partitionKey || o.customerEmail || '').toLowerCase()
      if (!email) continue
      const prev = statsByEmail.get(email) ?? {
        orderCount: 0,
        totalSpent: 0,
        lastOrder: undefined as string | undefined,
      }
      prev.orderCount += 1
      // Only count revenue from paid orders so the dashboard number
      // matches the "total revenue" stat on /admin.
      if (o.paymentStatus === 'paid') {
        prev.totalSpent += Number(o.displayTotal ?? 0)
      }
      const created = o.createdAt as string | undefined
      if (created && (!prev.lastOrder || new Date(created) > new Date(prev.lastOrder))) {
        prev.lastOrder = created
      }
      statsByEmail.set(email, prev)
    }

    const customers: CustomerView[] = users.map((u) => {
      const email = (u.rowKey as string).toLowerCase()
      const stats = statsByEmail.get(email)
      const provider: CustomerView['authProvider'] =
        u.authProvider === 'google' || u.authProvider === 'local'
          ? u.authProvider
          : u.googleId
            ? 'google'
            : u.passwordHash
              ? 'local'
              : 'unknown'
      return {
        id: email,
        email,
        name: (u.name as string) || email,
        phone: (u.phone as string) || undefined,
        picture: (u.picture as string) || undefined,
        authProvider: provider,
        createdAt: (u.createdAt as string) || undefined,
        lastLogin: (u.lastLogin as string) || undefined,
        orderCount: stats?.orderCount ?? 0,
        totalSpent: stats?.totalSpent ?? 0,
        lastOrder: stats?.lastOrder,
      }
    })

    // Most recently active first - falls back to createdAt then email so the
    // ordering stays deterministic even when there are no orders/logins yet.
    customers.sort((a, b) => {
      const at = new Date(a.lastOrder || a.lastLogin || a.createdAt || 0).getTime()
      const bt = new Date(b.lastOrder || b.lastLogin || b.createdAt || 0).getTime()
      if (bt !== at) return bt - at
      return a.email.localeCompare(b.email)
    })

    const filtered = q
      ? customers.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.email.toLowerCase().includes(q) ||
            (c.phone || '').toLowerCase().includes(q),
        )
      : customers

    return jsonResponse(
      { customers: filtered, total: filtered.length },
      200,
      {},
      origin,
    )
  } catch (err) {
    context.error('adminListCustomers failed', err)
    return errorResponse('Failed to load customers', 500, origin)
  }
}

app.http('adminListCustomers', {
  methods: ['GET', 'OPTIONS'],
  route: 'api/admin/customers',
  authLevel: 'anonymous',
  handler: adminListCustomers,
})
