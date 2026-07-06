/**
 * Stock reservation + compensating rollback.
 *
 * Extracted from functions/payments.ts (audit M4) so the compensation
 * loop can be unit tested without spinning up the full HTTP handler.
 * Behaviour-preserving - the payments handler creates a Reservation
 * ledger, calls reserveMany() to hold inventory before creating the
 * Razorpay order, and rolls back via rollbackReservations() if anything
 * downstream fails. On success the ledger is drained without a rollback.
 */

import type { InvocationContext } from '@azure/functions'
import {
  reserveStock,
  restoreStock,
  InsufficientStockError,
  StockConcurrencyError,
} from './tableStorage'

export interface ReservedItem {
  productId: string
  qty: number
}

export type ReserveOutcome =
  | { ok: true }
  | { ok: false; reason: 'INSUFFICIENT'; message: string }
  | { ok: false; reason: 'CONCURRENCY'; message: string }
  | { ok: false; reason: 'UNKNOWN' }

/**
 * A mutable ledger of items successfully reserved so far. Used by the
 * caller to trigger a compensating restore if a downstream step fails.
 * Splice-drain pattern: rollback empties the array so a subsequent
 * catch-arm can't double-restore.
 */
export function createReservationLedger(): ReservedItem[] {
  return []
}

/**
 * Reserve stock for the given items in order. On the first failure,
 * rollback everything reserved so far and return the failure reason.
 * On success, all items are held and the ledger is populated.
 */
export async function reserveMany(
  ledger: ReservedItem[],
  items: Array<{ productId: string; qty: number; title?: string }>,
  context?: InvocationContext,
): Promise<ReserveOutcome> {
  for (const item of items) {
    try {
      await reserveStock(item.productId, item.qty)
      ledger.push({ productId: item.productId, qty: item.qty })
    } catch (err) {
      await rollbackReservations(ledger, context)
      if (err instanceof InsufficientStockError) {
        return { ok: false, reason: 'INSUFFICIENT', message: err.message }
      }
      if (err instanceof StockConcurrencyError) {
        const label = item.title || item.productId
        return {
          ok: false,
          reason: 'CONCURRENCY',
          message: `${label} just sold - please refresh and try again.`,
        }
      }
      context?.error?.('reserveMany: unexpected error', err)
      return { ok: false, reason: 'UNKNOWN' }
    }
  }
  return { ok: true }
}

/**
 * Compensating restore. Drains the ledger so a subsequent rollback call
 * (e.g. from the outer catch) is a safe no-op. Failures are logged but
 * never rethrown - a partial restore is safer than a thrown exception
 * that swallows the original error path; the timer-triggered stale-
 * reservation cleanup sweeps whatever's left within 10 minutes.
 */
export async function rollbackReservations(
  ledger: ReservedItem[],
  context?: InvocationContext,
): Promise<void> {
  if (ledger.length === 0) return
  const toRestore = ledger.splice(0, ledger.length)
  for (const r of toRestore) {
    try {
      await restoreStock(r.productId, r.qty)
    } catch (restoreErr) {
      context?.error?.(
        `rollbackReservations: restoreStock failed for ${r.productId} qty=${r.qty}`,
        restoreErr,
      )
    }
  }
}
