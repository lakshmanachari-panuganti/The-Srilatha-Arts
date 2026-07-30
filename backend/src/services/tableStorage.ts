import { TableClient, odata } from '@azure/data-tables'
import { DefaultAzureCredential } from '@azure/identity'
import { randomBytes } from 'crypto'

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

// ─── IN-PROCESS CATALOG CACHE ────────────────────────────────
//
// The catalog is read-mostly and changes a few times a week, but every
// storefront request was performing a full table read, deserialisation
// and sort inside the function process. This is the cheapest possible
// fix: no infrastructure, no new service, and it reduces Table Storage
// transaction cost rather than adding to it.
//
// Scope: per-instance, per-cold-start. Two warm instances hold
// independent copies, so the effective staleness bound is the TTL, not
// TTL x instances. Writes call invalidateCatalog() so the instance that
// handled the edit is immediately correct; the rest converge within TTL.
//
// Deliberately NOT cached: getProductById. reserveStock reads it to make
// inventory decisions, and stale stock data oversells one-of-one artwork.
//
// Admin reads use the *Uncached variants below — admin traffic is
// negligible, and a 60s delay after saving an edit reads as "my change
// didn't save".

const CATALOG_TTL_MS = Number(process.env.CATALOG_CACHE_TTL_MS) || 60_000

/**
 * Hard ceiling on cache keys.
 *
 * Not a tuning knob — a correctness bound. One key is `products:cat:<category>`
 * and `category` comes straight off the query string of an anonymous endpoint,
 * so the key space is attacker-controlled. Without a cap, `?category=<random>`
 * in a loop grows this map by one permanent entry per distinct value until the
 * process runs out of memory. Expired entries alone don't save us: eviction
 * only happens on a *read* of that same key, and a random key is never read
 * twice.
 *
 * Real keys number `products:all` plus one per actual category, so anything
 * above that is headroom. 64 is far past it.
 */
const CATALOG_MAX_KEYS = 64

const _catalogCache = new Map<string, { value: Row[]; expiresAt: number }>()

/**
 * Make room for one new key, evicting expired entries first and falling back
 * to the oldest survivor. Map iterates in insertion order, so `keys().next()`
 * is the oldest — good enough here, and a real LRU would need bookkeeping on
 * every hit to protect a map this small.
 */
function evictForInsert(): void {
  if (_catalogCache.size < CATALOG_MAX_KEYS) return

  const now = Date.now()
  for (const [k, v] of _catalogCache) {
    if (v.expiresAt <= now) _catalogCache.delete(k)
  }

  while (_catalogCache.size >= CATALOG_MAX_KEYS) {
    const oldest = _catalogCache.keys().next()
    if (oldest.done) break
    _catalogCache.delete(oldest.value)
  }
}

async function cachedRows(key: string, load: () => Promise<Row[]>): Promise<Row[]> {
  const hit = _catalogCache.get(key)
  if (hit && hit.expiresAt > Date.now()) return hit.value

  const value = await load()
  // Frozen because callers receive the cached array *by reference*. Every
  // caller today reads it with .map()/.filter() (both non-mutating), but
  // one future `rows.sort()` or `rows.push()` would silently corrupt the
  // catalog for every other request served by this instance until the TTL
  // expired — a bug that reproduces intermittently and looks like a data
  // problem. Freezing turns that into an immediate, obvious throw.
  //
  // Shallow by design: this guards the array, not the row objects. Deep
  // freezing the whole catalog on every refresh is not worth the cost.
  Object.freeze(value)
  evictForInsert()
  _catalogCache.set(key, { value, expiresAt: Date.now() + CATALOG_TTL_MS })
  return value
}

export function invalidateCatalog(): void {
  _catalogCache.clear()
}

// ─── PRODUCTS ────────────────────────────────────────────────

function sortByOrder(rows: Row[]): Row[] {
  return rows.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
}

/** Uncached — for admin reads that must reflect a write immediately. */
export async function getAllProductsUncached(): Promise<Row[]> {
  return sortByOrder(await listAll('products'))
}

export async function getAllProducts(): Promise<Row[]> {
  return cachedRows('products:all', getAllProductsUncached)
}

export async function getProductsByCategory(category: string): Promise<Row[]> {
  return cachedRows(`products:cat:${category}`, async () =>
    sortByOrder(await listAll('products', odata`PartitionKey eq ${category}`)),
  )
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
      // Stock and inStock are part of the cached listing payload, so a
      // sale must evict it — otherwise a sold-out one-of-one keeps
      // showing as available in the grid for the rest of the TTL.
      invalidateCatalog()
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
      invalidateCatalog()
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
  invalidateCatalog()
}

export async function deleteProduct(category: string, productId: string): Promise<void> {
  const client = getTableClient('products')
  await client.deleteEntity(category, productId)
  invalidateCatalog()
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

/**
 * True when the user has at least one order with a CAPTURED payment.
 *
 * Used by the first-time-buyer coupon gate — "first-time" means "no
 * prior successful purchase on this account", not "hasn't used this
 * specific coupon code before" (which the coupon logic used to check
 * incorrectly, letting returning customers use FIRSTBUY-style codes).
 *
 * Query is single-partition (partitionKey = userEmail) so cost scales
 * with the user's own order history, not the whole table. Stops at the
 * first match — coupon evaluation only needs existence, not a count.
 *
 * Cancelled/refunded/failed orders don't count as a prior purchase;
 * only CAPTURED signals a completed transaction. This means a customer
 * whose one prior order was refunded is still "first-time" for coupon
 * purposes, which matches the marketing intent.
 */
export async function hasPriorCapturedOrder(userEmail: string): Promise<boolean> {
  if (!userEmail) return false
  const client = getTableClient('orders')
  const iter = client.listEntities<Row>({
    queryOptions: {
      filter: odata`PartitionKey eq ${userEmail} and paymentStatus eq 'CAPTURED'`,
    },
  })
  for await (const _ of iter) {
    return true
  }
  return false
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

// ─── ORDERS BY RAZORPAY ID (secondary index - audit H3) ─────
//
// Reverse-map from razorpayOrderId → internal orderId so the
// /razorpay/verify and webhook paths can find our order via a single-row
// point lookup instead of a full-table scan. Written at order-creation
// time; read only when the client-supplied internalOrderId isn't
// available. If the lookup ever misses, the caller can still fall back
// to the scan (kept as last-resort in payments.ts).

export async function upsertOrderByRazorpayId(
  razorpayOrderId: string,
  internalOrderId: string,
  userEmail: string,
): Promise<void> {
  const client = await ensureTable('ordersByRazorpayId')
  await client.upsertEntity(
    {
      partitionKey: 'razorpay',
      rowKey: razorpayOrderId,
      internalOrderId,
      userEmail,
      createdAt: new Date().toISOString(),
    } as any,
    'Replace',
  )
}

export async function getInternalOrderIdByRazorpay(
  razorpayOrderId: string,
): Promise<{ internalOrderId: string; userEmail: string } | null> {
  const client = getTableClient('ordersByRazorpayId')
  try {
    const row = (await client.getEntity('razorpay', razorpayOrderId)) as Row
    return {
      internalOrderId: String(row.internalOrderId),
      userEmail: String(row.userEmail),
    }
  } catch (err: any) {
    if (err.statusCode === 404) return null
    throw err
  }
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

export async function getAllUsers(): Promise<Row[]> {
  return listAll('users', odata`PartitionKey eq ${'customer'}`)
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
  await ensureTable('announcements')
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
  const client = await ensureTable('announcements')
  try {
    return (await client.getEntity('banner', id)) as Row
  } catch (error: any) {
    if (error.statusCode === 404) return null
    throw error
  }
}

export async function upsertAnnouncement(announcement: Row): Promise<void> {
  const client = await ensureTable('announcements')
  await client.upsertEntity(announcement as any, 'Replace')
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const client = await ensureTable('announcements')
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

// ─── RATE LIMIT ATTEMPTS (append-only sliding window) ────────
//
// Replaces the read-modify-write counter below. The counter had no ETag
// precondition, so concurrent requests all read the same value and all
// wrote value+1 — N parallel attempts registered as one. That is exactly
// the shape of traffic a credential-stuffing tool produces, so the limit
// failed precisely when it mattered.
//
// This design writes one row per attempt instead. Appends never conflict,
// so there is no race to lose, no ETag retry, and no failure mode where
// the limiter silently undercounts. Counting is a bounded single-
// partition range query over the window.
//
// Layout:  PartitionKey = the rate-limit key  (one partition per
//                         IP / account, so queries never cross partitions)
//          RowKey       = <zero-padded epoch ms>_<random>
//                         Zero-padding makes lexical order == time order,
//                         which is what lets `RowKey ge <cutoff>` work as
//                         a sliding-window filter. The random suffix makes
//                         same-millisecond attempts collision-proof.
//
// Bonus: this is a true sliding window. The old counter was a fixed
// window an attacker could straddle (limit-1 at the end of one window,
// limit again at the start of the next).

const RL_TABLE = 'rateLimitAttempts'

/** Table Storage forbids / \ # ? and control chars in keys. */
function sanitizeKey(key: string): string {
  let out = ''
  for (const ch of key) {
    const code = ch.codePointAt(0) ?? 0
    const illegal =
      ch === '/' || ch === '\\' || ch === '#' || ch === '?' ||
      code < 0x20 || code === 0x7f
    out += illegal ? '_' : ch
  }
  return out
}

function stampRowKey(atMs: number): string {
  return `${String(atMs).padStart(15, '0')}_${randomBytes(4).toString('hex')}`
}

function cutoffRowKey(atMs: number): string {
  return String(atMs).padStart(15, '0')
}

export async function recordRateLimitAttempt(key: string, atMs: number): Promise<void> {
  const client = await ensureTable(RL_TABLE)
  await client.createEntity({
    partitionKey: sanitizeKey(key),
    rowKey: stampRowKey(atMs),
    at: atMs,
    createdAt: new Date(atMs).toISOString(),
  } as any)
}

/** Attempts recorded for `key` at or after `sinceMs`. */
export async function countRateLimitAttempts(key: string, sinceMs: number): Promise<number> {
  const client = await ensureTable(RL_TABLE)
  const pk = sanitizeKey(key)
  const floor = cutoffRowKey(sinceMs)
  let count = 0
  for await (const _row of client.listEntities({
    queryOptions: { filter: odata`PartitionKey eq ${pk} and RowKey ge ${floor}` },
  })) {
    count++
  }
  return count
}

/**
 * Delete up to 100 rows of one partition in a single round trip.
 *
 * Entity-group transactions are all-or-nothing, so a row another caller
 * already removed (404) aborts the whole batch. That is a normal race
 * here — the purge timer and a successful login can target the same
 * rows — so fall back to individual deletes rather than failing.
 */
async function deleteRowBatch(
  client: TableClient,
  partitionKey: string,
  rowKeys: string[],
): Promise<number> {
  if (rowKeys.length === 0) return 0
  try {
    await client.submitTransaction(
      rowKeys.map((rowKey) => ['delete', { partitionKey, rowKey }] as const) as any,
    )
    return rowKeys.length
  } catch {
    let deleted = 0
    for (const rowKey of rowKeys) {
      try {
        await client.deleteEntity(partitionKey, rowKey)
        deleted++
      } catch (err: any) {
        if (err?.statusCode !== 404) throw err
      }
    }
    return deleted
  }
}

const TXN_MAX = 100

/**
 * Drop every attempt for a key — called on successful login.
 *
 * Batched because this sits on the login response path: a user who
 * fumbled their password nine times would otherwise pay nine sequential
 * round trips before their session is returned.
 */
export async function clearRateLimitAttempts(key: string): Promise<void> {
  const client = await ensureTable(RL_TABLE)
  const pk = sanitizeKey(key)

  let batch: string[] = []
  for await (const row of client.listEntities<Row>({
    queryOptions: { filter: odata`PartitionKey eq ${pk}` },
  })) {
    batch.push(String(row.rowKey))
    if (batch.length === TXN_MAX) {
      await deleteRowBatch(client, pk, batch)
      batch = []
    }
  }
  await deleteRowBatch(client, pk, batch)
}

/**
 * Delete attempt rows older than `olderThanMs`.
 *
 * Table Storage has no TTL, so without this the table grows by one
 * permanent row per attempt forever. Swept by the existing
 * stale-reservation timer — no new trigger.
 *
 * Two deliberate constraints, both learned the hard way from the very
 * scan-and-delete pattern this codebase is trying to move away from:
 *
 *  1. BOUNDED. This is a cross-partition scan (there is no date
 *     partition to key on). Under a sustained attack the backlog could
 *     be tens of thousands of rows, and an unbounded sweep would exceed
 *     the Consumption-plan function timeout and fail — every run,
 *     forever, never making progress. `maxDeletions` caps the work per
 *     run; the next tick picks up where this one stopped. Ten minutes
 *     of extra retention is harmless.
 *
 *  2. BATCHED. Deletes are grouped into entity-group transactions of
 *     100 per partition, so a large backlog costs ~1% of the round
 *     trips a per-row loop would.
 *
 * Returns the number of rows deleted. A return value equal to
 * `maxDeletions` means there is more to do — the caller logs it so a
 * persistent backlog is visible rather than silent.
 */
export async function purgeRateLimitAttempts(
  olderThanMs: number,
  maxDeletions = 5_000,
): Promise<number> {
  const client = await ensureTable(RL_TABLE)
  const ceiling = cutoffRowKey(olderThanMs)

  // Group by partition so each batch satisfies the single-partition
  // requirement of entity-group transactions.
  const byPartition = new Map<string, string[]>()
  let collected = 0

  for await (const row of client.listEntities<Row>({
    queryOptions: { filter: odata`RowKey lt ${ceiling}` },
  })) {
    const pk = String(row.partitionKey)
    const bucket = byPartition.get(pk) ?? []
    bucket.push(String(row.rowKey))
    byPartition.set(pk, bucket)
    if (++collected >= maxDeletions) break
  }

  let purged = 0
  for (const [pk, rowKeys] of byPartition) {
    for (let i = 0; i < rowKeys.length; i += TXN_MAX) {
      purged += await deleteRowBatch(client, pk, rowKeys.slice(i, i + TXN_MAX))
    }
  }
  return purged
}

// ─── RATE LIMIT COUNTERS (legacy — superseded by the rows above) ──
//
// Retained only so an in-flight deploy that still has the old service
// code can read its counters. Safe to delete once the append-only
// limiter has been live for one full window (1 hour).

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

export async function deleteRateLimitCounter(key: string): Promise<void> {
  const client = getTableClient('rateLimits')
  try {
    await client.deleteEntity('counter', key)
  } catch (error: any) {
    if (error.statusCode === 404) return
    throw error
  }
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
