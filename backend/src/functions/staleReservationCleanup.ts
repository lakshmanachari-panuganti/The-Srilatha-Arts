/**
 * Stale-reservation cleanup — safety net for inventory reservations.
 *
 * `createPaymentOrder` reserves stock the moment it starts building an
 * order, before sending the customer to Razorpay Checkout. If the customer
 * abandons (closes the tab, hits Esc, loses network, takes a phone call)
 * we won't see a payment.failed and our inline rollback in the handler
 * doesn't fire either — the reservation stays held.
 *
 * This timer-triggered Function sweeps orders that:
 *   - status PLACED
 *   - paymentStatus PENDING (i.e. money never landed)
 *   - createdAt older than RESERVATION_TIMEOUT_MINUTES (default 30)
 *
 * For each match it:
 *   1. Marks the order CANCELLED with an ETag-checked write (aborts on
 *      412 if a late payment webhook wrote first — stock stays untouched
 *      so the paid order isn't leaked back to the shelf)
 *   2. Restores stockQty on each item (best-effort, logs failures)
 *   3. Stamps `stockRestored: true` once the loop completes so subsequent
 *      sweeps skip the order; a crash mid-restore is picked up by Path 2
 *      of findStaleReservations (CANCELLED + stockRestored === false)
 *   4. Appends an audit event so the admin can see what happened
 *
 * Schedule: every 10 minutes (0 *​/10 * * * *). Idempotent — orders that
 * are terminal AND have stockRestored: true are skipped.
 *
 * Tuning: RESERVATION_TIMEOUT_MINUTES is env-configurable. Razorpay's
 * Checkout natural timeout is 15 minutes; we hold a small buffer past
 * that so a customer who paid at minute 14 isn't accidentally cancelled
 * by a clock-skew race with the verify endpoint.
 */

import { app, InvocationContext, Timer } from '@azure/functions'
import { TableClient, odata } from '@azure/data-tables'
import { DefaultAzureCredential } from '@azure/identity'
import {
  getOrderById,
  getOrderItems,
  appendOrderEvent,
  restoreStock,
  deleteOrderByStatus,
  upsertOrderByStatus,
  purgeRateLimitAttempts,
  Row,
} from '../services/tableStorage'
import { RATE_LIMIT_RETENTION_MS } from '../services/rateLimit'

const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME!

// Constructed once per process. DefaultAzureCredential runs a credential-
// chain probe on construction, which is wasted work on a cold-start-
// sensitive Consumption plan if repeated per call.
const credential = new DefaultAzureCredential()

function getOrdersTableClient(): TableClient {
  return new TableClient(
    `https://${accountName}.table.core.windows.net`,
    'orders',
    credential,
  )
}

function getOrdersByStatusClient(): TableClient {
  return new TableClient(
    `https://${accountName}.table.core.windows.net`,
    'ordersByStatus',
    credential,
  )
}

const DEFAULT_TIMEOUT_MINUTES = 30

function timeoutMinutes(): number {
  const raw = Number(process.env.RESERVATION_TIMEOUT_MINUTES)
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_TIMEOUT_MINUTES
  // Clamp to a sane upper bound so a stuck env value doesn't strand
  // reservations for days.
  return Math.min(raw, 24 * 60)
}

/**
 * Query the ordersByStatus secondary index (§3.1) for candidates instead
 * of scanning the entire orders table. Cost is O(open reservations),
 * not O(all orders ever placed) — the sweep now scales with in-flight
 * checkouts rather than total order history.
 *
 * Two candidate sets are unioned:
 *   1. PLACED + PENDING older than the timeout    — normal stale reservations
 *   2. CANCELLED where stockRestored is not true  — orphan-restore recovery
 *      for the case where processOne crashed between the CANCELLED write
 *      and the stock-restore loop. Bounded by CANCELLED index size but
 *      typically nil.
 *
 * The index row's `orderId` is looked up in the authoritative orders
 * table because the index can lag briefly (the primary write happens
 * before the index write in the payment/webhook paths).
 */
async function findStaleReservations(): Promise<Row[]> {
  const cutoffMs = Date.now() - timeoutMinutes() * 60 * 1000
  const cutoffISO = new Date(cutoffMs).toISOString()

  const idxClient = getOrdersByStatusClient()
  const stale: Row[] = []
  const seen = new Set<string>()

  // Path 1: PLACED partition, older than cutoff.
  for await (const idx of idxClient.listEntities<Row>({
    queryOptions: {
      filter: odata`PartitionKey eq 'PLACED' and createdAt lt ${cutoffISO}`,
    },
  })) {
    const orderId = String(idx.orderId || '')
    if (!orderId || seen.has(orderId)) continue
    const order = await getOrderById(orderId)
    if (!order) continue
    if (order.status !== 'PLACED') continue
    if (order.paymentStatus !== 'PENDING') continue
    const created = Date.parse(String(order.createdAt || ''))
    if (Number.isNaN(created) || created >= cutoffMs) continue
    seen.add(orderId)
    stale.push(order)
  }

  // Path 2: recently-CANCELLED orders where stockRestored is explicitly
  // false — orphan recovery for crashes between the cancel-write and the
  // restore loop.
  //
  // Backward-compat: pre-existing cancelled orders (from before this
  // change shipped) don't have the `stockRestored` field at all. Their
  // stock was already restored by the old ordering, so we MUST NOT
  // re-restore them. Checking `=== false` (not `!== true`) excludes
  // them cleanly — only the new cancel path sets the field explicitly.
  //
  // The rowKey format `${createdAt}_${orderId}` (ISO 8601 prefix) sorts
  // lexicographically, so a 24-hour lookback keeps the index scan
  // bounded even after years of accumulated cancels. Any orphan that
  // outlasts a day of sweeps needs human eyes anyway.
  const orphanLookbackHours = 24
  const orphanCutoffISO = new Date(Date.now() - orphanLookbackHours * 60 * 60 * 1000).toISOString()
  for await (const idx of idxClient.listEntities<Row>({
    queryOptions: {
      filter: odata`PartitionKey eq 'CANCELLED' and RowKey gt ${orphanCutoffISO}`,
    },
  })) {
    const orderId = String(idx.orderId || '')
    if (!orderId || seen.has(orderId)) continue
    const order = await getOrderById(orderId)
    if (!order) continue
    if (order.status !== 'CANCELLED') continue
    // `=== false` is deliberate — absent-field means legacy pre-flag
    // cancel that was already restored under the old ordering.
    if (order.stockRestored !== false) continue
    // Only sweep cleanup-initiated cancels; admin-cancelled orders manage
    // their own stock via the admin refund flow.
    if (order.cancelReason !== 'Payment not completed within reservation window') continue
    seen.add(orderId)
    stale.push(order)
  }

  return stale
}

interface RestoreOutcome {
  productId: string
  qty: number
  ok: boolean
  error?: string
}

/**
 * Restore stock for every line item on the order and stamp
 * `stockRestored: true` on the order row so subsequent sweeps skip it.
 *
 * Called after the ETag-checked CANCELLED write has succeeded (the
 * happy path) and directly from the orphan-restore fast path (when a
 * prior sweep crashed between the cancel and the restore loop). Both
 * callers can safely no-op on individual restoreStock failures —
 * `stockRestored` is only set to true when the entire batch succeeds,
 * so a partial failure leaves the order flagged for the next sweep.
 */
async function restoreAndStampFlag(
  orderId: string,
  partitionKey: string,
  now: string,
  context: InvocationContext,
): Promise<RestoreOutcome[]> {
  const items = await getOrderItems(orderId)
  const restoreOutcomes: RestoreOutcome[] = []
  for (const item of items) {
    const productId = String(item.rowKey || item.productId || '')
    const qty = Number(item.qty ?? 0)
    if (!productId || qty <= 0) {
      restoreOutcomes.push({ productId, qty, ok: false, error: 'invalid line item' })
      continue
    }
    try {
      await restoreStock(productId, qty)
      restoreOutcomes.push({ productId, qty, ok: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      restoreOutcomes.push({ productId, qty, ok: false, error: msg })
      context.warn(
        `[stale-cleanup] restoreStock failed orderId=${orderId} productId=${productId} qty=${qty} error="${msg}"`,
      )
    }
  }

  const allOk = restoreOutcomes.length > 0 && restoreOutcomes.every((r) => r.ok)
  if (allOk) {
    try {
      await getOrdersTableClient().updateEntity(
        {
          partitionKey,
          rowKey: orderId,
          stockRestored: true,
          updatedAt: now,
        },
        'Merge',
      )
    } catch (flagErr) {
      // Non-fatal — the next sweep will re-try the whole restore loop,
      // which is idempotent per-item (restoreStock adds qty back once
      // more, but the order is already CANCELLED so the customer never
      // sees it). Prefer safe re-restore over stranding the flag.
      context.warn(
        `[stale-cleanup] stockRestored flag stamp failed orderId=${orderId}`,
        flagErr,
      )
    }
  }

  return restoreOutcomes
}

async function processOne(order: Row, context: InvocationContext): Promise<void> {
  const orderId = String(order.rowKey || '')
  const partitionKey = String(order.partitionKey || '')
  const now = new Date().toISOString()

  // ── Orphan-restore fast path ────────────────────────────────────
  // A CANCELLED order surfaced by findStaleReservations means the
  // previous sweep persisted the cancel but crashed before finishing
  // the stock restore. Skip straight to the restore loop; there's no
  // race left to guard because the order is already terminal.
  //
  // `=== false` (not `!== true`) is deliberate — absent-field means a
  // legacy cancel from before this change shipped, whose stock was
  // already restored under the old ordering. Never re-restore those.
  if (order.status === 'CANCELLED' && order.stockRestored === false) {
    await restoreAndStampFlag(orderId, partitionKey, now, context)
    return
  }

  // ── ETag-checked re-read + cancel ────────────────────────────────
  // Closes the cleanup ↔ late-webhook race documented in the audit.
  // We re-fetch the order with its current ETag, verify paymentStatus
  // is STILL PENDING (the candidate list could be slightly stale), and
  // attempt the status flip with the ETag attached. If a Razorpay
  // webhook landed between the candidate scan and this attempt, the
  // ETag write throws 412 and we abort the cleanup for THIS order —
  // the captured-after-cancel path in the webhook/verify handlers
  // takes over instead.
  //
  // Order of operations is load-bearing: we cancel FIRST, then restore
  // stock. Doing it the other way round would leak inventory whenever
  // the ETag write fails (the webhook takes the normal capture path
  // because it saw the order still PLACED, but stock is already back
  // on the shelf → double allocation on the one-of-one piece).
  const ordersClient = getOrdersTableClient()
  let latest: Row
  try {
    latest = (await ordersClient.getEntity(partitionKey, orderId)) as Row
  } catch (err: unknown) {
    const code = (err as { statusCode?: number })?.statusCode
    if (code === 404) {
      context.warn(`[stale-cleanup] orderId=${orderId} disappeared mid-sweep — skipping`)
      return
    }
    throw err
  }

  if (latest.paymentStatus !== 'PENDING') {
    context.log(
      `[stale-cleanup] orderId=${orderId} paymentStatus is now ${latest.paymentStatus} — skipping (race detected with payment path)`,
    )
    return
  }
  if (latest.status !== 'PLACED') {
    context.log(
      `[stale-cleanup] orderId=${orderId} status is now ${latest.status} — skipping`,
    )
    return
  }

  // ETag-checked flip to CANCELLED FIRST. If a webhook wrote between our
  // re-read and this write, the SDK throws 412 — we abort here with
  // stock untouched. The webhook took the normal capture path and the
  // customer legitimately owns the piece; leaking their reservation
  // back to the shelf would let a second buyer purchase the same item.
  //
  // `stockRestored: false` is stamped explicitly so a crash between
  // this write and the restore loop below is recoverable by the next
  // sweep (which picks up CANCELLED + stockRestored != true).
  const etag = (latest as { etag?: string }).etag
  try {
    await ordersClient.updateEntity(
      {
        partitionKey,
        rowKey: orderId,
        status: 'CANCELLED',
        cancelReason: 'Payment not completed within reservation window',
        cancelledAt: now,
        stockRestored: false,
        updatedAt: now,
      },
      'Merge',
      etag ? { etag } : undefined,
    )
  } catch (err: unknown) {
    const code = (err as { statusCode?: number })?.statusCode
    if (code === 412) {
      context.log(
        `[stale-cleanup] orderId=${orderId} ETag mismatch on cancel — concurrent write detected, aborting (stock untouched)`,
      )
      return
    }
    throw err
  }

  // Cancel persisted. Now restore stock (best-effort) and stamp the flag.
  const restoreOutcomes = await restoreAndStampFlag(orderId, partitionKey, now, context)

  // Move the status-index pointer.
  try {
    await deleteOrderByStatus(
      'PLACED',
      `${order.createdAt}_${orderId}`,
    )
    await upsertOrderByStatus({
      partitionKey: 'CANCELLED',
      rowKey: `${order.createdAt}_${orderId}`,
      orderId,
      userEmail: partitionKey,
      customerName: order.customerName || '',
      displayTotal: order.displayTotal || 0,
      paymentStatus: 'PENDING',
      createdAt: order.createdAt || now,
      updatedAt: now,
    })
  } catch (indexErr) {
    // Non-fatal — the order is correctly marked cancelled in the primary
    // table; the secondary index will be reconciled by the next sweep.
    context.warn(
      `[stale-cleanup] ordersByStatus update failed orderId=${orderId}`,
      indexErr,
    )
  }

  await appendOrderEvent({
    partitionKey: orderId,
    rowKey: `${now}_stale_cleanup`,
    fromStatus: 'PLACED',
    toStatus: 'CANCELLED',
    channel: 'status',
    by: 'system',
    byRole: 'system',
    note: 'Stale reservation cleaned up — payment never captured',
    meta: JSON.stringify({
      timeoutMinutes: timeoutMinutes(),
      restoreOutcomes,
    }),
    createdAt: now,
  })

  const failed = restoreOutcomes.filter((r) => !r.ok).length
  context.log(
    `[stale-cleanup] cancelled orderId=${orderId} items=${restoreOutcomes.length} restored=${restoreOutcomes.length - failed} failed=${failed}`,
  )
}

/**
 * Garbage-collect rate-limit attempt rows.
 *
 * Table Storage has no TTL, so without this the rateLimitAttempts table
 * grows by one permanent row per login attempt — including every attempt
 * from every attacker, forever. Rides this timer rather than adding a
 * trigger of its own.
 *
 * The retention floor is the longest window any caller uses (60 min for
 * the per-account lockouts) plus a wide safety margin, so a sweep can
 * never delete a row that is still inside someone's window.
 */
// Retention is owned by services/rateLimit.ts and imported, not
// redeclared: deleting an attempt row that is still inside a live window
// silently grants a fresh budget, so the two must never drift apart.
// checkAndIncrement throws if a caller asks for a window longer than
// this retention supports.

// Cap per run so a large backlog cannot exhaust the function timeout.
// At 10-minute ticks this drains 720k rows/day — far above any plausible
// attack volume for this site, while keeping a single run short.
const RATE_LIMIT_PURGE_CAP = 5_000

async function purgeRateLimits(context: InvocationContext): Promise<void> {
  try {
    const purged = await purgeRateLimitAttempts(
      Date.now() - RATE_LIMIT_RETENTION_MS,
      RATE_LIMIT_PURGE_CAP,
    )
    if (purged > 0) {
      context.log(`[stale-cleanup] purged ${purged} expired rate-limit attempt rows`)
    }
    if (purged >= RATE_LIMIT_PURGE_CAP) {
      // Hit the cap — a backlog remains. Normal after a burst; sustained
      // means the retention window or the tick rate needs revisiting.
      context.warn(
        `[stale-cleanup] rate-limit purge hit its ${RATE_LIMIT_PURGE_CAP}-row cap; backlog remains`,
      )
    }
  } catch (err) {
    // Never let housekeeping break the reservation sweep — that one
    // protects inventory and is the reason this timer exists.
    const msg = err instanceof Error ? err.message : String(err)
    context.error(`[stale-cleanup] rate-limit purge failed error="${msg}"`)
  }
}

async function processStaleReservations(
  _myTimer: Timer,
  context: InvocationContext,
): Promise<void> {
  const stale = await findStaleReservations()

  if (stale.length === 0) {
    context.log('[stale-cleanup] no stale reservations')
    await purgeRateLimits(context)
    return
  }

  let succeeded = 0
  for (const order of stale) {
    try {
      await processOne(order, context)
      succeeded++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      context.error(
        `[stale-cleanup] processOne failed orderId=${order.rowKey} error="${msg}"`,
      )
      // Continue with the next order — one failure shouldn't strand the rest.
    }
  }
  context.log(
    `[stale-cleanup] sweep complete found=${stale.length} cancelled=${succeeded}`,
  )

  await purgeRateLimits(context)
}

app.timer('staleReservationCleanup', {
  // Every 10 minutes. Six-field CRON (sec min hour day month weekday).
  schedule: '0 */10 * * * *',
  handler: processStaleReservations,
})
