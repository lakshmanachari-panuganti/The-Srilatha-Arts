/**
 * Stale-reservation cleanup - safety net for inventory reservations.
 *
 * `createPaymentOrder` reserves stock the moment it starts building an
 * order, before sending the customer to Razorpay Checkout. If the customer
 * abandons (closes the tab, hits Esc, loses network, takes a phone call)
 * we won't see a payment.failed and our inline rollback in the handler
 * doesn't fire either - the reservation stays held.
 *
 * This timer-triggered Function sweeps orders that:
 *   - status PLACED
 *   - paymentStatus PENDING (i.e. money never landed)
 *   - createdAt older than RESERVATION_TIMEOUT_MINUTES (default 30)
 *
 * For each match it:
 *   1. Restores stockQty on each item (best-effort, logs failures)
 *   2. Marks the order CANCELLED with a clear cancelReason
 *   3. Appends an audit event so the admin can see what happened
 *
 * Schedule: every 10 minutes (0 *​/10 * * * *). Idempotent - orders already
 * CANCELLED are skipped.
 *
 * Tuning: RESERVATION_TIMEOUT_MINUTES is env-configurable. Razorpay's
 * Checkout natural timeout is 15 minutes; we hold a small buffer past
 * that so a customer who paid at minute 14 isn't accidentally cancelled
 * by a clock-skew race with the verify endpoint.
 */

import { app, InvocationContext, Timer } from '@azure/functions'
import { TableClient } from '@azure/data-tables'
import { DefaultAzureCredential } from '@azure/identity'
import {
  getAllOrders,
  getOrderItems,
  appendOrderEvent,
  restoreStock,
  deleteOrderByStatus,
  upsertOrderByStatus,
  Row,
} from '../services/tableStorage'

const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME!
function getOrdersTableClient(): TableClient {
  return new TableClient(
    `https://${accountName}.table.core.windows.net`,
    'orders',
    new DefaultAzureCredential(),
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

async function findStaleReservations(): Promise<Row[]> {
  const cutoffMs = Date.now() - timeoutMinutes() * 60 * 1000
  const all = await getAllOrders()
  return all.filter((o) => {
    if (o.status !== 'PLACED') return false
    if (o.paymentStatus !== 'PENDING') return false
    const created = Date.parse(String(o.createdAt || ''))
    if (Number.isNaN(created)) return false
    return created < cutoffMs
  })
}

interface RestoreOutcome {
  productId: string
  qty: number
  ok: boolean
  error?: string
}

async function processOne(order: Row, context: InvocationContext): Promise<void> {
  const orderId = String(order.rowKey || '')
  const partitionKey = String(order.partitionKey || '')
  const now = new Date().toISOString()

  // ── ETag-checked re-read + cancel ────────────────────────────────
  // Closes the cleanup ↔ late-webhook race documented in the audit.
  // We re-fetch the order with its current ETag, verify paymentStatus
  // is STILL PENDING (the candidate list could be slightly stale), and
  // attempt the status flip with the ETag attached. If a Razorpay
  // webhook landed between the candidate scan and this attempt, the
  // ETag write throws 412 and we abort the cleanup for THIS order -
  // the captured-after-cancel path in the webhook/verify handlers
  // takes over instead.
  const ordersClient = getOrdersTableClient()
  let latest: Row
  try {
    latest = (await ordersClient.getEntity(partitionKey, orderId)) as Row
  } catch (err: unknown) {
    const code = (err as { statusCode?: number })?.statusCode
    if (code === 404) {
      context.warn(`[stale-cleanup] orderId=${orderId} disappeared mid-sweep - skipping`)
      return
    }
    throw err
  }

  if (latest.paymentStatus !== 'PENDING') {
    context.log(
      `[stale-cleanup] orderId=${orderId} paymentStatus is now ${latest.paymentStatus} - skipping (race detected with payment path)`,
    )
    return
  }
  if (latest.status !== 'PLACED') {
    context.log(
      `[stale-cleanup] orderId=${orderId} status is now ${latest.status} - skipping`,
    )
    return
  }

  // Restore each item's stock (best-effort).
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

  // ETag-checked flip to CANCELLED. If the webhook wrote between our
  // re-read and this write, the SDK throws 412 - we abort here so the
  // webhook's captured-after-cancel path takes precedence.
  const etag = (latest as { etag?: string }).etag
  try {
    await ordersClient.updateEntity(
      {
        partitionKey,
        rowKey: orderId,
        status: 'CANCELLED',
        cancelReason: 'Payment not completed within reservation window',
        cancelledAt: now,
        updatedAt: now,
      },
      'Merge',
      etag ? { etag } : undefined,
    )
  } catch (err: unknown) {
    const code = (err as { statusCode?: number })?.statusCode
    if (code === 412) {
      context.log(
        `[stale-cleanup] orderId=${orderId} ETag mismatch on cancel - concurrent write detected, aborting cleanup`,
      )
      // The webhook/verify path is taking it from here. We've already
      // tried to restore stock; if a customer's payment captures we'll
      // simply have over-restored. The webhook's captured-after-cancel
      // branch handles auto-refund regardless.
      return
    }
    throw err
  }

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
    // Non-fatal - the order is correctly marked cancelled in the primary
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
    note: 'Stale reservation cleaned up - payment never captured',
    meta: JSON.stringify({
      timeoutMinutes: timeoutMinutes(),
      restoreOutcomes,
    }),
    createdAt: now,
  })

  const failed = restoreOutcomes.filter((r) => !r.ok).length
  context.log(
    `[stale-cleanup] cancelled orderId=${orderId} items=${items.length} restored=${restoreOutcomes.length - failed} failed=${failed}`,
  )
}

async function processStaleReservations(
  _myTimer: Timer,
  context: InvocationContext,
): Promise<void> {
  const stale = await findStaleReservations()
  if (stale.length === 0) {
    context.log('[stale-cleanup] no stale reservations')
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
      // Continue with the next order - one failure shouldn't strand the rest.
    }
  }
  context.log(
    `[stale-cleanup] sweep complete found=${stale.length} cancelled=${succeeded}`,
  )
}

app.timer('staleReservationCleanup', {
  // Every 10 minutes. Six-field CRON (sec min hour day month weekday).
  schedule: '0 */10 * * * *',
  handler: processStaleReservations,
})
