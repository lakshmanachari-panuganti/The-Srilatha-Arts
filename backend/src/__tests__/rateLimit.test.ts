/**
 * Unit tests for services/rateLimit - behaviour of checkAndIncrement +
 * resetRateLimit that guards the per-account admin/user login lockout
 * introduced by security audit H1.
 *
 * The service depends on Azure Table Storage via getRateLimitCounter /
 * upsertRateLimitCounter / deleteRateLimitCounter. We mock those so the
 * suite is a pure unit test with no environment or network dependency.
 */

import { jest } from '@jest/globals'

// In-memory table simulating the rateLimits partition.
const store = new Map<string, { count: number; windowStart: number }>()

jest.mock('../services/tableStorage', () => ({
  getRateLimitCounter: jest.fn(async (key: string) => {
    const row = store.get(key)
    return row ? { partitionKey: 'counter', rowKey: key, ...row } : null
  }),
  // Create-only insert used for the fresh-window path. Mirrors Azure Table
  // semantics: 409 EntityAlreadyExists when the row is present, so the
  // fresh-window race resolves to one winner + retries into the increment
  // path instead of everyone writing count=1.
  createRateLimitCounter: jest.fn(async (row: { rowKey: string; count: number; windowStart: number }) => {
    if (store.has(row.rowKey)) {
      const err: Error & { statusCode?: number } = new Error('EntityAlreadyExists')
      err.statusCode = 409
      throw err
    }
    store.set(row.rowKey, { count: row.count, windowStart: row.windowStart })
  }),
  // ETag-conditional write-back used by the increment path and the
  // expired-window reset. The in-memory store carries no etags, so this
  // behaves like an unconditional replace - the 412-retry path is exercised
  // implicitly (no conflict → single pass).
  updateRateLimitCounterWithEtag: jest.fn(async (row: { rowKey: string; count: number; windowStart: number }) => {
    store.set(row.rowKey, { count: row.count, windowStart: row.windowStart })
  }),
  deleteRateLimitCounter: jest.fn(async (key: string) => {
    store.delete(key)
  }),
}))

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { checkAndIncrement, peekRateLimit, resetRateLimit } = require('../services/rateLimit') as {
  checkAndIncrement: (key: string, limit: number, windowMs: number) => Promise<{ allowed: boolean; remaining: number }>
  peekRateLimit: (key: string, limit: number, windowMs: number) => Promise<{ allowed: boolean; remaining: number }>
  resetRateLimit: (key: string) => Promise<void>
}

beforeEach(() => {
  store.clear()
})

describe('rateLimit - per-account lockout (audit H1)', () => {
  it('lets first N calls through, blocks the N+1', async () => {
    const key = 'login_fail:e@x.io'
    for (let i = 0; i < 3; i++) {
      const r = await checkAndIncrement(key, 3, 60_000)
      expect(r.allowed).toBe(true)
    }
    const overflow = await checkAndIncrement(key, 3, 60_000)
    expect(overflow.allowed).toBe(false)
  })

  it('locks the account regardless of which IP called (per-account key)', async () => {
    // The caller uses account (email) in the key, not IP - a distributed
    // attack that rotates IPs still hits the same lockout counter.
    const email = 'target@example.com'
    for (let i = 0; i < 3; i++) {
      const r = await checkAndIncrement(`login_fail:${email}`, 3, 60_000)
      expect(r.allowed).toBe(true)
    }
    // Same email, different "IP" - key is per-account so blocked.
    const blocked = await checkAndIncrement(`login_fail:${email}`, 3, 60_000)
    expect(blocked.allowed).toBe(false)
  })

  it('resetRateLimit clears the counter (called on successful login)', async () => {
    const key = 'login_fail:e@x.io'
    await checkAndIncrement(key, 3, 60_000)
    await checkAndIncrement(key, 3, 60_000)
    await resetRateLimit(key)
    const fresh = await checkAndIncrement(key, 3, 60_000)
    expect(fresh.allowed).toBe(true)
    expect(fresh.remaining).toBe(2) // fresh window, first attempt
  })

  it('separate accounts have independent lockouts', async () => {
    for (let i = 0; i < 3; i++) {
      await checkAndIncrement('login_fail:a@x.io', 3, 60_000)
    }
    const aBlocked = await checkAndIncrement('login_fail:a@x.io', 3, 60_000)
    const bAllowed = await checkAndIncrement('login_fail:b@x.io', 3, 60_000)
    expect(aBlocked.allowed).toBe(false)
    expect(bAllowed.allowed).toBe(true)
  })
})

describe('checkAndIncrement - fresh-window concurrency safety', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mocks = require('../services/tableStorage') as {
    createRateLimitCounter: jest.Mock
    updateRateLimitCounterWithEtag: jest.Mock
  }

  beforeEach(() => {
    mocks.createRateLimitCounter.mockClear()
    mocks.updateRateLimitCounterWithEtag.mockClear()
  })

  it('uses create-only insert for the first request; later requests increment', async () => {
    const key = 'login:1.2.3.4'
    await checkAndIncrement(key, 5, 60_000)
    await checkAndIncrement(key, 5, 60_000)
    // Only the very first call creates; the second must take the
    // ETag-guarded increment path (this is the anti-burst guarantee).
    expect(mocks.createRateLimitCounter).toHaveBeenCalledTimes(1)
    expect(mocks.updateRateLimitCounterWithEtag).toHaveBeenCalledTimes(1)
    expect(store.get(key)?.count).toBe(2)
  })

  it('a lost create race (409) falls through to the increment path', async () => {
    const key = 'login:9.9.9.9'
    // Simulate a concurrent winner landing between our read (null) and our
    // create: first create call sees the row already present.
    mocks.createRateLimitCounter.mockImplementationOnce(async () => {
      store.set(key, { count: 1, windowStart: Date.now() })
      const err: Error & { statusCode?: number } = new Error('EntityAlreadyExists')
      err.statusCode = 409
      throw err
    })
    const r = await checkAndIncrement(key, 5, 60_000)
    // The loser retried, read the winner's row and incremented - NOT reset.
    expect(r.allowed).toBe(true)
    expect(store.get(key)?.count).toBe(2)
  })

  it('an expired window resets via the ETag-guarded replace, not an upsert', async () => {
    const key = 'login:expired-window'
    store.set(key, { count: 99, windowStart: Date.now() - 120_000 })
    const r = await checkAndIncrement(key, 5, 60_000)
    expect(r.allowed).toBe(true)
    expect(r.remaining).toBe(4)
    expect(store.get(key)?.count).toBe(1)
    expect(mocks.createRateLimitCounter).not.toHaveBeenCalled()
    expect(mocks.updateRateLimitCounterWithEtag).toHaveBeenCalledTimes(1)
  })
})

describe('peekRateLimit - read-only check (no increment)', () => {
  it('allows when no counter exists, with full remaining budget', async () => {
    const r = await peekRateLimit('login_fail:fresh@x.io', 3, 60_000)
    expect(r.allowed).toBe(true)
    expect(r.remaining).toBe(3)
  })

  it('does NOT consume attempts - repeated peeks never block', async () => {
    const key = 'login_fail:peeker@x.io'
    for (let i = 0; i < 20; i++) {
      const r = await peekRateLimit(key, 3, 60_000)
      expect(r.allowed).toBe(true)
    }
    expect(store.has(key)).toBe(false) // nothing was written
  })

  it('reflects failures recorded by checkAndIncrement', async () => {
    const key = 'login_fail:victim@x.io'
    await checkAndIncrement(key, 3, 60_000)
    await checkAndIncrement(key, 3, 60_000)
    const r = await peekRateLimit(key, 3, 60_000)
    expect(r.allowed).toBe(true)
    expect(r.remaining).toBe(1)
  })

  it('blocks once the limit is reached', async () => {
    const key = 'login_fail:locked@x.io'
    for (let i = 0; i < 3; i++) {
      await checkAndIncrement(key, 3, 60_000)
    }
    const r = await peekRateLimit(key, 3, 60_000)
    expect(r.allowed).toBe(false)
    expect(r.remaining).toBe(0)
  })

  it('allows again once the fixed window has expired', async () => {
    const key = 'login_fail:expired@x.io'
    store.set(key, { count: 99, windowStart: Date.now() - 120_000 })
    const r = await peekRateLimit(key, 3, 60_000)
    expect(r.allowed).toBe(true)
    expect(r.remaining).toBe(3)
  })
})
