import { TableClient, odata } from '@azure/data-tables'
import { DefaultAzureCredential } from '@azure/identity'

const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME!
const credential = new DefaultAzureCredential()

function getTableClient(tableName: string): TableClient {
  return new TableClient(
    `https://${accountName}.table.core.windows.net`,
    tableName,
    credential
  )
}

// Per-process cache of "we've already verified this table exists" so we
// only pay the createTable() round-trip once per cold start, per table.
// Self-healing: lets new tables (added in code) be reached without
// re-running the infra script. Race-safe - concurrent first calls both
// race for createTable(), TableAlreadyExists is benign.
const _tableEnsured = new Set<string>()
async function ensureTable(tableName: string): Promise<TableClient> {
  const client = getTableClient(tableName)
  if (_tableEnsured.has(tableName)) return client
  try {
    await client.createTable()
  } catch (e: any) {
    // Azure returns either `TableAlreadyExists` or a 409 - both mean
    // someone else got there first, which is exactly what we want.
    const code = e?.code || e?.details?.errorCode || ''
    if (code !== 'TableAlreadyExists' && e?.statusCode !== 409) {
      // Anything else (permissions, network) - let the caller see it
      // rather than silently masking a configuration problem.
      throw e
    }
  }
  _tableEnsured.add(tableName)
  return client
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>

async function listAll(tableName: string, filter?: string): Promise<Row[]> {
  const client = getTableClient(tableName)
  const rows: Row[] = []
  const opts = filter ? { queryOptions: { filter } } : undefined
  for await (const entity of client.listEntities(opts)) {
    rows.push(entity as Row)
  }
  return rows
}

async function listPaginated(
  tableName: string,
  filter: string | undefined,
  page: number,
  size: number,
): Promise<{ rows: Row[]; total: number }> {
  const all = await listAll(tableName, filter)
  const total = all.length
  const start = (page - 1) * size
  return { rows: all.slice(start, start + size), total }
}

// ─── PRODUCTS ────────────────────────────────────────────────

export async function getAllProducts(): Promise<Row[]> {
  const rows = await listAll('products')
  return rows.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
}

export async function getProductsByCategory(category: string): Promise<Row[]> {
  const rows = await listAll('products', odata`PartitionKey eq ${category}`)
  return rows.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
}

export async function getProduct(category: string, productId: string): Promise<Row | null> {
  const client = getTableClient('products')
  try {
    return (await client.getEntity(category, productId)) as Row
  } catch (error: any) {
    if (error.statusCode === 404) return null
    throw error
  }
}

export async function getProductById(productId: string): Promise<Row | null> {
  // ID format: <category>-<8hexchars> e.g. "dot-mandala-f55f2641"
  // Strip last 9 chars (hyphen + 8 hex chars) to get the partition key (category).
  const category = productId.slice(0, -9)
  return getProduct(category, productId)
}

// ─── INVENTORY RESERVATION ────────────────────────────────────
//
// Optimistic-concurrency-controlled stock helpers used by the order flow
// to prevent over-selling of one-of-one (and limited-edition) artwork.
//
// Implementation: read the product row (gets its ETag), compute the new
// stockQty, and write back with `mode: 'Merge'` + `{ etag }`. If another
// caller updated the row between our read and write the SDK throws with
// statusCode 412 and we retry up to MAX_RETRIES times. After exhausting
// retries we throw an InsufficientStockError so the caller can surface
// a clean message to the user ("Just sold — please refresh").
//
// reserveStock decrements; restoreStock increments. Both are best-effort
// idempotent on repeated calls only when wrapped in a higher-level
// reservation token (see payments.ts createPaymentOrder for the
// reservation lifecycle).

const STOCK_MAX_RETRIES = 4
const STOCK_RETRY_DELAY_MS = 80

export class InsufficientStockError extends Error {
  productId: string
  available: number
  requested: number
  constructor(productId: string, available: number, requested: number, productTitle?: string) {
    super(
      productTitle
        ? `Only ${available} of "${productTitle}" available (requested ${requested})`
        : `Only ${available} units of product ${productId} available (requested ${requested})`,
    )
    this.name = 'InsufficientStockError'
    this.productId = productId
    this.available = available
    this.requested = requested
  }
}

export class StockConcurrencyError extends Error {
  productId: string
  constructor(productId: string) {
    super(`Stock update for ${productId} failed after ${STOCK_MAX_RETRIES} retries — concurrent updates`)
    this.name = 'StockConcurrencyError'
    this.productId = productId
  }
}

async function _sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Atomically decrement stockQty for a product. Throws InsufficientStockError
 * if not enough stock, StockConcurrencyError if too many concurrent updates
 * lost the optimistic-concurrency race. Sets inStock=false when stockQty
 * reaches zero so PDP listings reflect it immediately.
 *
 * Returns the post-decrement stockQty on success.
 */
export async function reserveStock(productId: string, qty: number): Promise<number> {
  if (!Number.isInteger(qty) || qty <= 0) {
    throw new Error(`reserveStock: qty must be a positive integer (got ${qty})`)
  }
  const client = getTableClient('products')

  for (let attempt = 1; attempt <= STOCK_MAX_RETRIES; attempt++) {
    const product = await getProductById(productId)
    if (!product) throw new Error(`reserveStock: product ${productId} not found`)
    if (product.inStock === false) {
      throw new InsufficientStockError(productId, 0, qty, product.title)
    }
    // stockQty undefined or null = "unlimited" inventory (legacy products).
    // Treat as unlimited and skip the decrement entirely so we don't
    // accidentally clamp them to zero.
    if (product.stockQty == null) return Number.MAX_SAFE_INTEGER

    const current = Number(product.stockQty)
    if (current < qty) {
      throw new InsufficientStockError(productId, current, qty, product.title)
    }

    const newQty = current - qty
    const newInStock = newQty > 0
    const etag = product.etag as string | undefined

    try {
      await client.updateEntity(
        {
          partitionKey: product.partitionKey as string,
          rowKey: product.rowKey as string,
          stockQty: newQty,
          inStock: newInStock,
        },
        'Merge',
        etag ? { etag } : undefined,
      )
      return newQty
    } catch (err: any) {
      if (err?.statusCode === 412 && attempt < STOCK_MAX_RETRIES) {
        await _sleep(STOCK_RETRY_DELAY_MS * attempt)
        continue
      }
      if (err?.statusCode === 412) {
        throw new StockConcurrencyError(productId)
      }
      throw err
    }
  }
  throw new StockConcurrencyError(productId)
}

/**
 * Increment stockQty by qty. Used to compensate for a failed payment after
 * a reservation succeeded. Best-effort retry on optimistic-concurrency
 * loss; an extra retry budget vs reserveStock because restoring inventory
 * should rarely fail silently — operational data integrity matters more
 * than throughput here.
 *
 * Setting inStock=true is unconditional: any successful restore returns
 * the product to "for sale" state regardless of the new total.
 */
export async function restoreStock(productId: string, qty: number): Promise<void> {
  if (!Number.isInteger(qty) || qty <= 0) {
    throw new Error(`restoreStock: qty must be a positive integer (got ${qty})`)
  }
  const client = getTableClient('products')
  const RESTORE_RETRIES = STOCK_MAX_RETRIES + 2

  for (let attempt = 1; attempt <= RESTORE_RETRIES; attempt++) {
    const product = await getProductById(productId)
    if (!product) {
      // Product was deleted between reserve and restore (admin action).
      // Nothing to restore to — log + drop silently so the caller's
      // compensating loop completes.
      return
    }
    if (product.stockQty == null) return // unlimited inventory — no-op

    const current = Number(product.stockQty)
    const newQty = current + qty
    const etag = product.etag as string | undefined

    try {
      await client.updateEntity(
        {
          partitionKey: product.partitionKey as string,
          rowKey: product.rowKey as string,
          stockQty: newQty,
          inStock: true,
        },
        'Merge',
        etag ? { etag } : undefined,
      )
      return
    } catch (err: any) {
      if (err?.statusCode === 412 && attempt < RESTORE_RETRIES) {
        await _sleep(STOCK_RETRY_DELAY_MS * attempt)
        continue
      }
      throw err
    }
  }
  throw new StockConcurrencyError(productId)
}

export async function getFeaturedProducts(): Promise<Row[]> {
  return (await getAllProducts()).filter((p) => p.featured === true)
}

export async function getNewArrivals(): Promise<Row[]> {
  return (await getAllProducts()).filter((p) => p.isNewArrival === true)
}

export async function getBestSellers(): Promise<Row[]> {
  return (await getAllProducts()).filter((p) => p.isBestSeller === true)
}

// On-sale = compareAtPrice is set and strictly greater than the display
// price. Same rule the frontend uses to compute `isOnSale` in the API
// adapter (functions/products.ts toApi). Lives here so listing routes
// don't have to ship the full catalog to the browser for client-side
// filtering on a growing catalog.
export async function getOnSaleProducts(): Promise<Row[]> {
  return (await getAllProducts()).filter((p) => {
    const cmp = typeof p.compareAtPrice === 'number' ? p.compareAtPrice : 0
    const price = typeof p.displayPrice === 'number' ? p.displayPrice : (p.price ?? 0)
    return cmp > 0 && cmp > price
  })
}

// ─── NEWSLETTER ──────────────────────────────────────────────

// Newsletter subscriber row. PK is a fixed bucket ('subscribers'); RK is
// the lowercased email so resubmits are naturally idempotent (upsertEntity
// will just refresh the row instead of creating duplicates). Status starts
// at 'pending' so a future double-opt-in flow can flip it to 'confirmed'.
export async function addNewsletterSubscriber(
  email: string,
  source: string = 'footer',
): Promise<void> {
  const client = await ensureTable('newsletterSubscribers')
  const now = new Date().toISOString()
  await client.upsertEntity(
    {
      partitionKey: 'subscribers',
      rowKey: email.toLowerCase(),
      email: email.toLowerCase(),
      source,
      status: 'pending',
      createdAt: now,
    } as any,
    'Merge', // merge so a re-subscribe doesn't wipe future status changes
  )
}

export async function upsertProduct(product: Row): Promise<void> {
  const client = getTableClient('products')
  await client.upsertEntity(product as any, 'Replace')
}

export async function deleteProduct(category: string, productId: string): Promise<void> {
  const client = getTableClient('products')
  await client.deleteEntity(category, productId)
}

// ─── ORDERS (new PK=userEmail scheme - §3) ───────────────────

export async function createOrder(order: Row): Promise<void> {
  const client = getTableClient('orders')
  await client.createEntity(order as any)
}

/**
 * Get an order by owner email + orderId.
 * New PK strategy: partitionKey = userEmail, rowKey = orderId.
 */
export async function getOrderByOwner(userEmail: string, orderId: string): Promise<Row | null> {
  const client = getTableClient('orders')
  try {
    return (await client.getEntity(userEmail, orderId)) as Row
  } catch (error: any) {
    if (error.statusCode === 404) return null
    throw error
  }
}

/**
 * Find an order by ID regardless of owner - scans all partitions.
 * Used by admin endpoints.
 */
export async function getOrderById(orderId: string): Promise<Row | null> {
  const rows = await listAll('orders', odata`RowKey eq ${orderId}`)
  return rows[0] ?? null
}

/**
 * List all orders for a user (GET /api/orders/me).
 * Single-partition query - fast.
 */
export async function getOrdersByUser(userEmail: string): Promise<Row[]> {
  const rows = await listAll('orders', odata`PartitionKey eq ${userEmail}`)
  return rows.sort(
    (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
  )
}

/**
 * Update an order's fields in-place (merge update - no row move).
 */
export async function mergeOrder(userEmail: string, orderId: string, fields: Row): Promise<void> {
  const client = getTableClient('orders')
  await client.updateEntity(
    { partitionKey: userEmail, rowKey: orderId, ...fields },
    'Merge',
  )
}

export async function getAllOrders(): Promise<Row[]> {
  const rows = await listAll('orders')
  return rows.sort(
    (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
  )
}

// Legacy compat - used during migration; remove after Stage 2.
export async function updateOrderStatus(
  currentStatus: string,
  orderId: string,
  newStatus: string
): Promise<void> {
  const client = getTableClient('orders')
  const order = (await client.getEntity(currentStatus, orderId)) as Row
  // Upsert into new partition first - if this fails the original is untouched
  await client.upsertEntity({
    ...order,
    partitionKey: newStatus,
    updatedAt: new Date().toISOString(),
  } as any, 'Replace')
  // Delete from old partition - if this fails the order exists in both partitions
  // (harmless duplicate, not data loss)
  await client.deleteEntity(currentStatus, orderId)
}

// ─── ORDER ITEMS ─────────────────────────────────────────────

export async function createOrderItem(item: Row): Promise<void> {
  const client = getTableClient('orderItems')
  await client.createEntity(item as any)
}

export async function getOrderItems(orderId: string): Promise<Row[]> {
  return listAll('orderItems', odata`PartitionKey eq ${orderId}`)
}

// ─── ORDER EVENTS (append-only audit log - §2.1) ─────────────

export async function appendOrderEvent(event: Row): Promise<void> {
  const client = getTableClient('orderEvents')
  await client.createEntity(event as any)
}

export async function getOrderEvents(orderId: string, includeInternal = false): Promise<Row[]> {
  const rows = await listAll('orderEvents', odata`PartitionKey eq ${orderId}`)
  const filtered = includeInternal
    ? rows
    : rows.filter((e) => e.channel !== 'internal')
  return filtered.sort(
    (a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime()
  )
}

// ─── ORDERS BY STATUS (secondary index - §3.1) ──────────────

export async function upsertOrderByStatus(row: Row): Promise<void> {
  const client = getTableClient('ordersByStatus')
  await client.upsertEntity(row as any, 'Replace')
}

export async function deleteOrderByStatus(status: string, rowKey: string): Promise<void> {
  const client = getTableClient('ordersByStatus')
  try {
    await client.deleteEntity(status, rowKey)
  } catch (error: any) {
    if (error.statusCode !== 404) throw error
  }
}

export async function getOrdersByStatus(
  status: string,
  page = 1,
  size = 20,
): Promise<{ rows: Row[]; total: number }> {
  return listPaginated(
    'ordersByStatus',
    odata`PartitionKey eq ${status}`,
    page,
    size,
  )
}

// ─── USERS ───────────────────────────────────────────────────

export async function getUser(email: string): Promise<Row | null> {
  const client = getTableClient('users')
  try {
    return (await client.getEntity('customer', email)) as Row
  } catch (error: any) {
    if (error.statusCode === 404) return null
    throw error
  }
}

export async function getUserByGoogleId(googleId: string): Promise<Row | null> {
  const rows = await listAll('users', odata`googleId eq ${googleId}`)
  return rows[0] ?? null
}

export async function createUser(user: Row): Promise<void> {
  const client = getTableClient('users')
  await client.createEntity(user as any)
}

export async function updateUser(user: Row): Promise<void> {
  const client = getTableClient('users')
  await client.upsertEntity(user as any, 'Replace')
}

// ─── ADMINS ──────────────────────────────────────────────────

export async function getAdmin(username: string): Promise<Row | null> {
  const client = getTableClient('admins')
  try {
    return (await client.getEntity('admin', username)) as Row
  } catch (error: any) {
    if (error.statusCode === 404) return null
    throw error
  }
}

export async function createAdmin(admin: Row): Promise<void> {
  const client = getTableClient('admins')
  await client.createEntity(admin as any)
}

export async function updateAdmin(admin: Row): Promise<void> {
  const client = getTableClient('admins')
  await client.upsertEntity(admin as any, 'Replace')
}

export async function getAllAdmins(): Promise<Row[]> {
  return listAll('admins')
}

// ─── ANNOUNCEMENTS ───────────────────────────────────────────

export async function listAnnouncements(includeInactive = false): Promise<Row[]> {
  const rows = await listAll('announcements')
  const filtered = includeInactive
    ? rows
    : rows.filter((r) => {
        if (r.active === false) return false
        const now = Date.now()
        if (r.startDate && new Date(String(r.startDate)).getTime() > now) return false
        if (r.endDate && new Date(String(r.endDate)).getTime() < now) return false
        return true
      })
  return filtered.sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
}

export async function getAnnouncement(id: string): Promise<Row | null> {
  const client = getTableClient('announcements')
  try {
    return (await client.getEntity('banner', id)) as Row
  } catch (error: any) {
    if (error.statusCode === 404) return null
    throw error
  }
}

export async function upsertAnnouncement(announcement: Row): Promise<void> {
  const client = getTableClient('announcements')
  await client.upsertEntity(announcement as any, 'Replace')
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const client = getTableClient('announcements')
  await client.deleteEntity('banner', id)
}

// ─── COUPONS ─────────────────────────────────────────────────

export async function getCoupon(code: string): Promise<Row | null> {
  const client = getTableClient('coupons')
  try {
    return (await client.getEntity('coupon', code.toUpperCase())) as Row
  } catch (error: any) {
    if (error.statusCode === 404) return null
    throw error
  }
}

export async function listCoupons(): Promise<Row[]> {
  return listAll('coupons')
}

export async function upsertCoupon(coupon: Row): Promise<void> {
  const client = getTableClient('coupons')
  await client.upsertEntity(coupon as any, 'Replace')
}

export async function deleteCoupon(code: string): Promise<void> {
  const client = getTableClient('coupons')
  await client.deleteEntity('coupon', code.toUpperCase())
}

export async function getCouponRedemptions(code: string): Promise<Row[]> {
  return listAll('couponRedemptions', odata`PartitionKey eq ${code.toUpperCase()}`)
}

export async function getCouponRedemptionsByUser(code: string, userEmail: string): Promise<Row[]> {
  const rows = await getCouponRedemptions(code)
  return rows.filter((r) => r.userEmail === userEmail)
}

export async function createCouponRedemption(redemption: Row): Promise<void> {
  const client = getTableClient('couponRedemptions')
  await client.createEntity(redemption as any)
}

// ─── WISHLIST ────────────────────────────────────────────────

export async function getWishlist(userEmail: string): Promise<Row[]> {
  await ensureTable('wishlist')
  return listAll('wishlist', odata`PartitionKey eq ${userEmail}`)
}

export async function addToWishlist(userEmail: string, productId: string): Promise<void> {
  const client = await ensureTable('wishlist')
  await client.upsertEntity(
    {
      partitionKey: userEmail,
      rowKey: productId,
      addedAt: new Date().toISOString(),
    } as any,
    'Replace',
  )
}

export async function removeFromWishlist(userEmail: string, productId: string): Promise<void> {
  const client = await ensureTable('wishlist')
  try {
    await client.deleteEntity(userEmail, productId)
  } catch (error: any) {
    if (error.statusCode !== 404) throw error
  }
}

// ─── CART ────────────────────────────────────────────────────
// Per-user cart persistence, same shape as wishlist (PK=userEmail,
// RK=productId, with `quantity` and `addedAt` payload). Listing and
// mutation helpers are intentionally tiny - the route handler does the
// product enrichment so the client sees a self-contained item row
// (title, image, price) without needing a separate /products fetch.

export async function getCart(userEmail: string): Promise<Row[]> {
  // Self-heal: ensures the `cart` table exists. If a deploy lands the new
  // code before the infra script has been re-run, this still works.
  await ensureTable('cart')
  return listAll('cart', odata`PartitionKey eq ${userEmail}`)
}

export async function upsertCartItem(
  userEmail: string,
  productId: string,
  quantity: number,
): Promise<void> {
  const client = await ensureTable('cart')
  await client.upsertEntity(
    {
      partitionKey: userEmail,
      rowKey: productId,
      quantity: Math.max(1, Math.floor(quantity)),
      addedAt: new Date().toISOString(),
    } as any,
    'Replace',
  )
}

export async function removeCartItem(userEmail: string, productId: string): Promise<void> {
  const client = await ensureTable('cart')
  try {
    await client.deleteEntity(userEmail, productId)
  } catch (error: any) {
    if (error.statusCode !== 404) throw error
  }
}

export async function clearCart(userEmail: string): Promise<void> {
  const client = await ensureTable('cart')
  const rows = await listAll('cart', odata`PartitionKey eq ${userEmail}`)
  await Promise.all(
    rows.map((r) =>
      client.deleteEntity(userEmail, r.rowKey as string).catch((e: { statusCode?: number }) => {
        if (e.statusCode !== 404) throw e
      }),
    ),
  )
}

export async function isInWishlist(userEmail: string, productId: string): Promise<boolean> {
  const client = getTableClient('wishlist')
  try {
    await client.getEntity(userEmail, productId)
    return true
  } catch {
    return false
  }
}

// ─── REVIEWS ─────────────────────────────────────────────────

export async function getReviewsByProduct(productId: string, onlyApproved = true): Promise<Row[]> {
  const rows = await listAll('reviews', odata`PartitionKey eq ${productId}`)
  return onlyApproved ? rows.filter((r) => r.status === 'approved') : rows
}

export async function getReview(productId: string, reviewId: string): Promise<Row | null> {
  const client = getTableClient('reviews')
  try {
    return (await client.getEntity(productId, reviewId)) as Row
  } catch (error: any) {
    if (error.statusCode === 404) return null
    throw error
  }
}

export async function createReview(review: Row): Promise<void> {
  const client = getTableClient('reviews')
  await client.createEntity(review as any)
}

export async function updateReview(review: Row): Promise<void> {
  const client = getTableClient('reviews')
  await client.upsertEntity(review as any, 'Replace')
}

export async function getAllReviews(status?: string): Promise<Row[]> {
  const rows = await listAll('reviews')
  if (status) return rows.filter((r) => r.status === status)
  return rows
}

/**
 * Find an existing review by a specific user for a specific product.
 * Used to prevent duplicate reviews (H-06).
 * Scans a single partition (by productId) so this is bounded.
 */
export async function getReviewByUser(productId: string, userEmail: string): Promise<Row | null> {
  const rows = await listAll('reviews', odata`PartitionKey eq ${productId} and userEmail eq ${userEmail}`)
  return rows[0] ?? null
}

// ─── CUSTOM ORDERS ───────────────────────────────────────────

export async function createCustomOrder(order: Row): Promise<void> {
  const client = getTableClient('customOrders')
  await client.createEntity(order as any)
}

export async function getCustomOrder(rowKey: string): Promise<Row | null> {
  const client = getTableClient('customOrders')
  try {
    return (await client.getEntity('inbox', rowKey)) as Row
  } catch (error: any) {
    if (error.statusCode === 404) return null
    throw error
  }
}

export async function listCustomOrders(status?: string): Promise<Row[]> {
  const rows = await listAll('customOrders')
  if (status) return rows.filter((r) => r.status === status)
  return rows.sort(
    (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
  )
}

export async function updateCustomOrder(order: Row): Promise<void> {
  const client = getTableClient('customOrders')
  await client.upsertEntity(order as any, 'Replace')
}

// ─── ADDRESSES ───────────────────────────────────────────────

export async function getAddresses(userEmail: string): Promise<Row[]> {
  return listAll('addresses', odata`PartitionKey eq ${userEmail}`)
}

export async function getAddress(userEmail: string, addressId: string): Promise<Row | null> {
  const client = getTableClient('addresses')
  try {
    return (await client.getEntity(userEmail, addressId)) as Row
  } catch (error: any) {
    if (error.statusCode === 404) return null
    throw error
  }
}

export async function upsertAddress(address: Row): Promise<void> {
  const client = getTableClient('addresses')
  await client.upsertEntity(address as any, 'Replace')
}

export async function deleteAddress(userEmail: string, addressId: string): Promise<void> {
  const client = getTableClient('addresses')
  await client.deleteEntity(userEmail, addressId)
}

/**
 * Clear `isDefault` on all addresses except the specified one.
 */
export async function clearDefaultAddress(userEmail: string, exceptId?: string): Promise<void> {
  const addresses = await getAddresses(userEmail)
  const client = getTableClient('addresses')
  for (const addr of addresses) {
    if (addr.isDefault && addr.rowKey !== exceptId) {
      await client.updateEntity(
        { partitionKey: userEmail, rowKey: addr.rowKey, isDefault: false },
        'Merge',
      )
    }
  }
}

// ─── NOTIFICATIONS ───────────────────────────────────────────

export async function logNotification(notification: Row): Promise<void> {
  const client = getTableClient('notifications')
  await client.createEntity(notification as any)
}

// ─── EMAIL LOGS ──────────────────────────────────────────────
// Self-healing table - ensure exists since this is a new table and
// existing dev/prod environments won't have it provisioned yet.

export async function appendEmailLog(entry: Row): Promise<void> {
  const client = await ensureTable('emailLogs')
  await client.createEntity(entry as any)
}

export async function getEmailLogsForOrder(orderId: string): Promise<Row[]> {
  await ensureTable('emailLogs')
  const rows = await listAll('emailLogs', odata`PartitionKey eq ${orderId}`)
  return rows.sort(
    (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
  )
}

/**
 * Sitewide email-log listing for the admin notifications page. Scans all
 * partitions because emailLog is partitioned by orderId — there's no
 * natural date partition. At studio volume (~100 orders/month × ~6
 * notifications each = ~600 rows/month) this is fine; revisit when
 * volume grows.
 */
export async function listAllEmailLogs(fromIso?: string, toIso?: string): Promise<Row[]> {
  await ensureTable('emailLogs')
  const filters: string[] = []
  if (fromIso) filters.push(odata`createdAt ge ${fromIso}`)
  if (toIso) filters.push(odata`createdAt lt ${toIso}`)
  const filter = filters.length ? filters.join(' and ') : undefined
  const rows = await listAll('emailLogs', filter)
  return rows.sort(
    (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
  )
}

// ─── WHATSAPP MESSAGES ───────────────────────────────────────
// Per-message append-only log + per-phone conversation rollup.
// Both tables self-heal via ensureTable until the infra script
// runs in dev/prd. Once Deploy-Infrastructure.ps1 lists them in
// $tableNames the ensureTable cache short-circuits.

export async function appendWhatsAppMessage(entry: Row): Promise<void> {
  const client = await ensureTable('whatsappMessages')
  await client.createEntity(entry as any)
}

export async function listWhatsAppMessagesForPhone(phone: string): Promise<Row[]> {
  await ensureTable('whatsappMessages')
  const rows = await listAll('whatsappMessages', odata`PartitionKey eq ${phone}`)
  return rows.sort(
    (a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime(),
  )
}

export async function findWhatsAppMessageByWamid(wamid: string): Promise<Row | null> {
  await ensureTable('whatsappMessages')
  const rows = await listAll('whatsappMessages', odata`waMessageId eq ${wamid}`)
  return rows[0] ?? null
}

/**
 * Sitewide WhatsApp-message listing for the admin notifications page.
 * Partitioned by phone — no natural date partition — so we scan with a
 * server-side createdAt filter and sort client-side.
 */
export async function listAllWhatsAppMessages(fromIso?: string, toIso?: string): Promise<Row[]> {
  await ensureTable('whatsappMessages')
  const filters: string[] = []
  if (fromIso) filters.push(odata`createdAt ge ${fromIso}`)
  if (toIso) filters.push(odata`createdAt lt ${toIso}`)
  const filter = filters.length ? filters.join(' and ') : undefined
  const rows = await listAll('whatsappMessages', filter)
  return rows.sort(
    (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
  )
}

export async function updateWhatsAppMessageStatus(
  phone: string,
  rowKey: string,
  status: string,
  statusError?: string,
): Promise<void> {
  const client = await ensureTable('whatsappMessages')
  const patch: Row = {
    partitionKey: phone,
    rowKey,
    status,
    updatedAt: new Date().toISOString(),
  }
  if (statusError) patch.statusError = statusError
  await client.updateEntity(patch as any, 'Merge')
}

export async function upsertWhatsAppConversation(row: Row): Promise<void> {
  const client = await ensureTable('whatsappConversations')
  await client.upsertEntity(row as any, 'Merge')
}

export async function getWhatsAppConversation(phone: string): Promise<Row | null> {
  await ensureTable('whatsappConversations')
  try {
    const client = await ensureTable('whatsappConversations')
    return (await client.getEntity('conv', phone)) as Row
  } catch (error: any) {
    if (error.statusCode === 404) return null
    throw error
  }
}

export async function listWhatsAppConversations(): Promise<Row[]> {
  await ensureTable('whatsappConversations')
  const rows = await listAll('whatsappConversations', odata`PartitionKey eq 'conv'`)
  return rows.sort(
    (a, b) => new Date(b.lastMessageAt ?? 0).getTime() - new Date(a.lastMessageAt ?? 0).getTime(),
  )
}

// ─── AUDIT LOG ───────────────────────────────────────────────

export async function appendAuditLog(entry: Row): Promise<void> {
  const client = getTableClient('auditLog')
  await client.createEntity(entry as any)
}

export async function getAuditLog(page = 1, size = 50): Promise<{ rows: Row[]; total: number }> {
  return listPaginated('auditLog', undefined, page, size)
}

// ─── RATE LIMIT COUNTERS ─────────────────────────────────────

export async function getRateLimitCounter(key: string): Promise<Row | null> {
  const client = getTableClient('rateLimits')
  try {
    return (await client.getEntity('counter', key)) as Row
  } catch (error: any) {
    if (error.statusCode === 404) return null
    throw error
  }
}

export async function upsertRateLimitCounter(counter: Row): Promise<void> {
  const client = getTableClient('rateLimits')
  await client.upsertEntity(counter as any, 'Replace')
}

// ─── CONFIG ──────────────────────────────────────────────────

export async function getConfig(key: string): Promise<any> {
  const client = getTableClient('config')
  try {
    const entity = (await client.getEntity('config', key)) as Row
    return JSON.parse(entity.value as string)
  } catch {
    return null
  }
}

export async function setConfig(key: string, value: any): Promise<void> {
  const client = getTableClient('config')
  await client.upsertEntity(
    { partitionKey: 'config', rowKey: key, value: JSON.stringify(value) } as any,
    'Replace'
  )
}
