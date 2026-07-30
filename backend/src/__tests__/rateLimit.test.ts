/**
 * Unit tests for services/rateLimit — the per-IP and per-account lockout
 * that guards the admin/user login paths (security audit H1).
 *
 * The service depends on Azure Table Storage via recordRateLimitAttempt /
 * countRateLimitAttempts / clearRateLimitAttempts. We mock those so the
 * suite is a pure unit test with no environment or network dependency.
 *
 * The mock stores one timestamp per attempt, mirroring the real
 * append-only layout (PK = key, RK = padded epoch ms), so the sliding
 * window is exercised for real rather than stubbed.
 */

import { jest } from '@jest/globals'

// In-memory stand-in for the rateLimitAttempts table: key -> [timestamps]
const store = new Map<string, number[]>()

jest.mock('../services/tableStorage', () => ({
  recordRateLimitAttempt: jest.fn(async (key: string, atMs: number) => {
    const rows = store.get(key) ?? []
    rows.push(atMs)
    store.set(key, rows)
  }),
  countRateLimitAttempts: jest.fn(async (key: string, sinceMs: number) => {
    return (store.get(key) ?? []).filter((t) => t >= sinceMs).length
  }),
  clearRateLimitAttempts: jest.fn(async (key: string) => {
    store.delete(key)
  }),
}))

// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  checkAndIncrement,
  resetRateLimit,
  RATE_LIMIT_RETENTION_MS,
  MAX_SUPPORTED_WINDOW_MS,
} = require('../services/rateLimit') as {
  checkAndIncrement: (
    key: string,
    limit: number,
    windowMs: number,
  ) => Promise<{ allowed: boolean; remaining: number; resetAt: number }>
  resetRateLimit: (key: string) => Promise<void>
  RATE_LIMIT_RETENTION_MS: number
  MAX_SUPPORTED_WINDOW_MS: number
}

beforeEach(() => {
  store.clear()
  jest.restoreAllMocks()
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

  it('reports remaining budget accurately as attempts accumulate', async () => {
    const key = 'login:1.2.3.4'
    expect((await checkAndIncrement(key, 3, 60_000)).remaining).toBe(2)
    expect((await checkAndIncrement(key, 3, 60_000)).remaining).toBe(1)
    expect((await checkAndIncrement(key, 3, 60_000)).remaining).toBe(0)
  })
})

describe('rateLimit — sliding window', () => {
  it('expires attempts once they fall outside the window', async () => {
    const key = 'login_fail:slider@x.io'
    const t0 = 1_000_000_000_000

    jest.spyOn(Date, 'now').mockReturnValue(t0)
    for (let i = 0; i < 3; i++) {
      expect((await checkAndIncrement(key, 3, 60_000)).allowed).toBe(true)
    }
    expect((await checkAndIncrement(key, 3, 60_000)).allowed).toBe(false)

    // Advance past the window — the three old attempts age out.
    jest.spyOn(Date, 'now').mockReturnValue(t0 + 60_001)
    expect((await checkAndIncrement(key, 3, 60_000)).allowed).toBe(true)
  })

  it('does not reset wholesale at a fixed boundary', async () => {
    // Regression guard for the old fixed-window behaviour: an attacker
    // could spend limit-1 at the end of one window and a full limit
    // immediately after, doubling the effective rate. With a sliding
    // window the earlier attempts still count.
    const key = 'login_fail:straddle@x.io'
    const t0 = 1_000_000_000_000

    jest.spyOn(Date, 'now').mockReturnValue(t0 + 59_000)
    for (let i = 0; i < 3; i++) {
      expect((await checkAndIncrement(key, 3, 60_000)).allowed).toBe(true)
    }

    // 2s later: a fixed window would have rolled over and allowed more.
    jest.spyOn(Date, 'now').mockReturnValue(t0 + 61_000)
    expect((await checkAndIncrement(key, 3, 60_000)).allowed).toBe(false)
  })

  it('does not record an attempt that was denied', async () => {
    // Recording denied attempts would let an attacker hold a victim's
    // account locked forever by retrying inside every window.
    const key = 'login_fail:victim@x.io'
    for (let i = 0; i < 3; i++) await checkAndIncrement(key, 3, 60_000)

    await checkAndIncrement(key, 3, 60_000) // denied
    await checkAndIncrement(key, 3, 60_000) // denied

    expect(store.get(key)!.length).toBe(3)
  })
})

describe('rateLimit — retention guard', () => {
  it('rejects a window longer than retention can support', async () => {
    // Attempt rows are swept after RATE_LIMIT_RETENTION_MS. A window
    // longer than that would count against rows that no longer exist,
    // handing the caller a fresh budget early — a limit that looks
    // configured but does not hold. Fail loudly instead.
    await expect(
      checkAndIncrement('login_fail:x@x.io', 5, MAX_SUPPORTED_WINDOW_MS + 1),
    ).rejects.toThrow(/exceeds/)
  })

  it('accepts a window exactly at the supported maximum', async () => {
    const r = await checkAndIncrement('login_fail:y@x.io', 5, MAX_SUPPORTED_WINDOW_MS)
    expect(r.allowed).toBe(true)
  })

  it('supports every window currently used in production code', async () => {
    // Longest real window is the 60-minute per-account login lockout.
    const LONGEST_WINDOW_IN_USE_MS = 60 * 60_000
    expect(LONGEST_WINDOW_IN_USE_MS).toBeLessThanOrEqual(MAX_SUPPORTED_WINDOW_MS)
    expect(RATE_LIMIT_RETENTION_MS).toBeGreaterThan(LONGEST_WINDOW_IN_USE_MS)
  })
})

describe('rateLimit — concurrency (the bug this rewrite fixes)', () => {
  it('counts parallel attempts individually, not as one', async () => {
    // The previous read-modify-write counter had no ETag precondition, so
    // N concurrent requests all read the same value and all wrote value+1.
    // Ten parallel attempts registered as one, and the limiter was a no-op
    // against exactly the traffic it was meant to stop.
    const key = 'login:9.9.9.9'
    await Promise.all(
      Array.from({ length: 10 }, () => checkAndIncrement(key, 100, 60_000)),
    )
    expect(store.get(key)!.length).toBe(10)
  })

  it('blocks once a parallel burst has consumed the budget', async () => {
    const key = 'login:8.8.8.8'
    await Promise.all(
      Array.from({ length: 5 }, () => checkAndIncrement(key, 5, 60_000)),
    )
    const after = await checkAndIncrement(key, 5, 60_000)
    expect(after.allowed).toBe(false)
  })
})
