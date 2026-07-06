/**
 * Reserve-then-rollback tests (audits M2 + M4).
 *
 * The compensation loop lives on the money-critical checkout path - if
 * reserving item 3 of 5 throws, all 5 must go back on the shelf, not
 * just the first 2. These tests exercise the ledger + rollback pattern
 * with a mocked storage layer so nothing touches real Azure tables.
 */

import { jest } from '@jest/globals'

// Track calls so tests can assert restore was invoked with the right qtys.
const reserveCalls: Array<{ id: string; qty: number }> = []
const restoreCalls: Array<{ id: string; qty: number }> = []

class InsufficientStockError extends Error {
  constructor(m: string) { super(m); this.name = 'InsufficientStockError' }
}
class StockConcurrencyError extends Error {
  constructor(m: string) { super(m); this.name = 'StockConcurrencyError' }
}

// Failure control per productId - string of behaviour for the reserveStock mock:
//   'ok' | 'insufficient' | 'concurrency' | 'boom'
const stockBehaviour = new Map<string, string>()

jest.mock('../services/tableStorage', () => ({
  reserveStock: jest.fn(async (id: string, qty: number) => {
    reserveCalls.push({ id, qty })
    const b = stockBehaviour.get(id) ?? 'ok'
    if (b === 'insufficient') throw new InsufficientStockError(`Only 0 of ${id} available`)
    if (b === 'concurrency') throw new StockConcurrencyError('concurrent modification')
    if (b === 'boom') throw new Error('storage down')
  }),
  restoreStock: jest.fn(async (id: string, qty: number) => {
    restoreCalls.push({ id, qty })
  }),
  InsufficientStockError,
  StockConcurrencyError,
}))

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { reserveMany, rollbackReservations, createReservationLedger } = require('../services/stockReservation') as {
  reserveMany: (
    ledger: Array<{ productId: string; qty: number }>,
    items: Array<{ productId: string; qty: number; title?: string }>,
  ) => Promise<{ ok: boolean; reason?: string; message?: string }>
  rollbackReservations: (ledger: Array<{ productId: string; qty: number }>) => Promise<void>
  createReservationLedger: () => Array<{ productId: string; qty: number }>
}

beforeEach(() => {
  reserveCalls.length = 0
  restoreCalls.length = 0
  stockBehaviour.clear()
})

describe('reserveMany + rollback (audit M2/M4)', () => {
  it('reserves all items when nothing fails', async () => {
    const ledger = createReservationLedger()
    const out = await reserveMany(ledger, [
      { productId: 'a', qty: 1 },
      { productId: 'b', qty: 2 },
      { productId: 'c', qty: 3 },
    ])
    expect(out.ok).toBe(true)
    expect(ledger).toEqual([
      { productId: 'a', qty: 1 },
      { productId: 'b', qty: 2 },
      { productId: 'c', qty: 3 },
    ])
    expect(restoreCalls).toEqual([]) // never rolled back
  })

  it('rolls back ALL prior reservations when item mid-way runs out', async () => {
    stockBehaviour.set('c', 'insufficient')
    const ledger = createReservationLedger()
    const out = await reserveMany(ledger, [
      { productId: 'a', qty: 1 },
      { productId: 'b', qty: 2 },
      { productId: 'c', qty: 3 },
      { productId: 'd', qty: 4 },
    ])
    expect(out.ok).toBe(false)
    expect(out.reason).toBe('INSUFFICIENT')
    // 'a' + 'b' were reserved, 'c' threw before ledger.push, 'd' never tried.
    expect(restoreCalls).toEqual([
      { id: 'a', qty: 1 },
      { id: 'b', qty: 2 },
    ])
    // Ledger must be drained after rollback so a caller's outer catch
    // can't double-restore.
    expect(ledger).toEqual([])
  })

  it('surfaces a "just sold" message on concurrency error using the item title', async () => {
    stockBehaviour.set('b', 'concurrency')
    const ledger = createReservationLedger()
    const out = await reserveMany(ledger, [
      { productId: 'a', qty: 1 },
      { productId: 'b', qty: 2, title: 'Lippan Owl' },
    ])
    expect(out.ok).toBe(false)
    expect(out.reason).toBe('CONCURRENCY')
    expect(out.message).toContain('Lippan Owl')
  })

  it('rollbackReservations is idempotent - second call after drain is a no-op', async () => {
    const ledger = [{ productId: 'a', qty: 1 }]
    await rollbackReservations(ledger)
    await rollbackReservations(ledger)
    expect(restoreCalls).toEqual([{ id: 'a', qty: 1 }])
  })
})
