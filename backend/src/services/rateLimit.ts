/**
 * Rate Limiter - Table Storage sliding window (§10).
 * Used by coupon validate (5/min/IP) and login (20 failures/hour).
 */

import { getRateLimitCounter, upsertRateLimitCounter } from './tableStorage'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number  // epoch ms
}

/**
 * Check and increment a rate-limit counter.
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
  const counter = await getRateLimitCounter(key)

  // If no counter or window expired, start fresh.
  if (!counter || !counter.windowStart || (now - Number(counter.windowStart)) >= windowMs) {
    await upsertRateLimitCounter({
      partitionKey: 'counter',
      rowKey: key,
      count: 1,
      windowStart: now,
      updatedAt: new Date().toISOString(),
    })
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs }
  }

  const count = Number(counter.count) + 1
  const resetAt = Number(counter.windowStart) + windowMs

  if (count > limit) {
    return { allowed: false, remaining: 0, resetAt }
  }

  await upsertRateLimitCounter({
    ...counter,
    count,
    updatedAt: new Date().toISOString(),
  })

  return { allowed: true, remaining: limit - count, resetAt }
}
