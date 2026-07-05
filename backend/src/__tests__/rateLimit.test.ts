/**
 * Unit tests for services/rateLimit — behaviour of checkAndIncrement +
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
  upsertRateLimitCounter: jest.fn(async (row: { rowKey: string; count: number; windowStart: number }) => {
    store.set(row.rowKey, { count: row.count, windowStart: row.windowStart })
  }),
  deleteRateLimitCounter: jest.fn(async (key: string) => {
    store.delete(key)
  }),
}))

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { checkAndIncrement, resetRateLimit } = require('../services/rateLimit') as {
  checkAndIncrement: (key: string, limit: number, windowMs: number) => Promise<{ allowed: boolean; remaining: number }>
  resetRateLimit: (key: string) => Promise<void>
}

beforeEach(() => {
  store.clear()
})

describe('rateLimit — per-account lockout (audit H1)', () => {
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
    // The caller uses account (email) in the key, not IP — a distributed
    // attack that rotates IPs still hits the same lockout counter.
    const email = 'target@example.com'
    for (let i = 0; i < 3; i++) {
      const r = await checkAndIncrement(`login_fail:${email}`, 3, 60_000)
      expect(r.allowed).toBe(true)
    }
    // Same email, different "IP" — key is per-account so blocked.
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
