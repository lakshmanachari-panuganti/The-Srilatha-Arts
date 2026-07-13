/**
 * Rate Limiter - Table Storage fixed window (§10).
 * Used by coupon validate (5/min/IP) and login (20 failures/hour).
 * Increment path is ETag-guarded (optimistic concurrency).
 */

import {
  getRateLimitCounter,
  createRateLimitCounter,
  updateRateLimitCounterWithEtag,
  deleteRateLimitCounter,
} from './tableStorage'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number  // epoch ms
}

// Optimistic-concurrency retry budget for the increment write-back - same
// pattern as reserveStock in tableStorage.ts (ETag + 412 → re-read + retry).
const RL_MAX_RETRIES = 4
const RL_RETRY_DELAY_MS = 50

async function _sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Check and increment a rate-limit counter (fixed window).
 *
 * The increment is optimistic-concurrency safe: the counter is read with
 * its ETag and written back conditionally; a 412 (someone else incremented
 * between our read and write) re-reads and retries up to RL_MAX_RETRIES
 * times. If retries are exhausted we fail CLOSED (allowed: false) - that
 * only happens under sustained contention on one key, which for a limiter
 * is exactly the traffic pattern we want to block.
 *
 * @param key      Unique key, e.g. `coupon_validate:${ip}` or `login_fail:${ip}`
 * @param limit    Max requests allowed in the window
 * @param windowMs Window duration in milliseconds
 */
export async function checkAndIncrement(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = Date.now()

  for (let attempt = 1; attempt <= RL_MAX_RETRIES; attempt++) {
    const counter = await getRateLimitCounter(key)

    // Fresh window (no counter, or the window expired). This path must NOT
    // be an unconditional upsert: under a synchronized burst every racer
    // would observe "fresh", write count=1, and be allowed - undercounting
    // exactly when traffic is abusive. Instead: create-only insert when the
    // row is missing (409 on conflict), ETag-guarded replace when resetting
    // an expired row (412 on conflict). Exactly one racer wins; the losers
    // loop back, re-read the winner's row and take the increment path.
    if (!counter || !counter.windowStart || (now - Number(counter.windowStart)) >= windowMs) {
      const fresh = {
        partitionKey: 'counter',
        rowKey: key,
        count: 1,
        windowStart: now,
        updatedAt: new Date().toISOString(),
      }
      try {
        if (!counter) {
          await createRateLimitCounter(fresh)
        } else {
          await updateRateLimitCounterWithEtag(
            { ...counter, ...fresh },
            counter.etag as string | undefined,
          )
        }
        return { allowed: true, remaining: limit - 1, resetAt: now + windowMs }
      } catch (err: any) {
        const conflict = err?.statusCode === 409 || err?.statusCode === 412
        if (conflict && attempt < RL_MAX_RETRIES) {
          await _sleep(RL_RETRY_DELAY_MS * attempt)
          continue
        }
        if (conflict) {
          console.warn(`checkAndIncrement: fresh-window retries exhausted for "${key}" - failing closed`)
          return { allowed: false, remaining: 0, resetAt: now + windowMs }
        }
        throw err
      }
    }

    const count = Number(counter.count) + 1
    const resetAt = Number(counter.windowStart) + windowMs

    if (count > limit) {
      return { allowed: false, remaining: 0, resetAt }
    }

    const etag = counter.etag as string | undefined
    try {
      await updateRateLimitCounterWithEtag(
        {
          ...counter,
          count,
          updatedAt: new Date().toISOString(),
        },
        etag,
      )
      return { allowed: true, remaining: limit - count, resetAt }
    } catch (err: any) {
      if (err?.statusCode === 412 && attempt < RL_MAX_RETRIES) {
        await _sleep(RL_RETRY_DELAY_MS * attempt)
        continue
      }
      if (err?.statusCode === 412) {
        // Lost the race RL_MAX_RETRIES times - the key is under heavy
        // concurrent load. Fail closed rather than letting a burst through.
        console.warn(`checkAndIncrement: concurrency retries exhausted for "${key}" - failing closed`)
        return { allowed: false, remaining: 0, resetAt }
      }
      throw err
    }
  }
  // Unreachable - the loop always returns or throws - but keeps tsc happy.
  return { allowed: false, remaining: 0, resetAt: now + windowMs }
}

/**
 * Check a rate-limit counter WITHOUT incrementing it (read-only peek).
 * Used where the limiter must only count explicit failures - e.g. the
 * per-account login lockout: peek before the password check, increment
 * only on a failed attempt.
 */
export async function peekRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = Date.now()
  const counter = await getRateLimitCounter(key)

  // No counter or window expired - nothing counted against this key yet.
  if (!counter || !counter.windowStart || (now - Number(counter.windowStart)) >= windowMs) {
    return { allowed: true, remaining: limit, resetAt: now + windowMs }
  }

  const count = Number(counter.count)
  const resetAt = Number(counter.windowStart) + windowMs

  if (count >= limit) {
    return { allowed: false, remaining: 0, resetAt }
  }

  return { allowed: true, remaining: limit - count, resetAt }
}

/**
 * Clear a rate-limit counter. Called after a successful login so a legit
 * user's next attempt (after some sporadic wrong guesses) doesn't hit a
 * stale 429. Best-effort: a failure here is logged but not rethrown
 * because the caller's action (login success) has already happened.
 */
export async function resetRateLimit(key: string): Promise<void> {
  try {
    await deleteRateLimitCounter(key)
  } catch {
    // Row may already be gone (never created, or cleaned up) - that's fine.
  }
}
