/**
 * Admin Dashboard Stats Endpoint.
 *
 * GET  /api/admin/stats  - aggregated metrics for the overview dashboard
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { getAllOrders, getAllProducts, getAllUsers } from '../services/tableStorage'
import { requireAdmin } from '../middleware/adminGuard'
import { jsonResponse, errorResponse, corsPreflightResponse } from '../utils/response'

const PENDING_PACK_STATUSES = new Set(['PLACED', 'CONFIRMED', 'CRAFTING'])

async function adminGetStats(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)

  const admin = requireAdmin(request)
  if (!admin) return errorResponse('Unauthorized', 401, origin)

  try {
    const now = Date.now()
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000

    const [orders, products, users] = await Promise.all([
      getAllOrders(),
      getAllProducts(),
      getAllUsers().catch(() => []),
    ])
    const totalCustomers = users.length

    let totalRevenue = 0
    let ordersLast30Days = 0
    let pendingOrders = 0

    for (const order of orders) {
      if (order.paymentStatus === 'paid') {
        totalRevenue += Number(order.displayTotal ?? 0)
      }
      if (order.createdAt && new Date(order.createdAt).getTime() >= thirtyDaysAgo) {
        ordersLast30Days++
      }
      if (PENDING_PACK_STATUSES.has(order.status)) {
        pendingOrders++
      }
    }

    const activeProducts = products.filter((p) => p.inStock === true).length

    return jsonResponse(
      {
        totalRevenue: Math.round(totalRevenue),
        ordersLast30Days,
        activeProducts,
        totalCustomers,
        pendingOrders,
      },
      200,
      {},
      origin,
    )
  } catch (err) {
    context.error('adminGetStats failed', err)
    return errorResponse('Failed to load stats', 500, origin)
  }
}

app.http('adminGetStats', {
  methods: ['GET', 'OPTIONS'],
  route: 'api/admin/stats',
  authLevel: 'anonymous',
  handler: adminGetStats,
})
