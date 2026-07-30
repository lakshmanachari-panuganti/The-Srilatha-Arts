/**
 * Rate Limiter — append-only sliding window (§10).
 *
 * Used by:
 *   admin login    10 / 15 min per IP   +  5 / 60 min per account
 *   user login     10 / 15 min per IP   + 10 / 60 min per account
 *   register        5 / 60 min per IP
 *   google auth    10 / 15 min per IP
 *   forgot pw       3 / 60 min per IP
 *   reset pw        5 / 15 min per IP
 *   coupon validate 5 / 60 s   per IP
 *
 * ── Why this was rewritten ──────────────────────────────────────────
 *
 * The previous implementation was a read-modify-write counter with no
 * ETag precondition:
 *
 *     const counter = await getRateLimitCounter(key)   // read
 *     const count = Number(counter.count) + 1          // modify
 *     await upsertRateLimitCounter({ ...counter, count })  // write
 *
 * Concurrent requests all read the same value and all wrote value+1, so
 * N parallel attempts registered as ONE. A serial attacker was limited;
 * a parallel one was not limited at all. That is precisely the traffic
 * shape a credential-stuffing tool produces, so the control failed in
 * exactly the case it existed for.
 *
 * ── Why append-only rather than ETag retry ──────────────────────────
 *
 * An ETag precondition would fix the correctness bug, but it trades one
 * problem for another: under contention the loser of the race either
 * retries (latency on the auth path) or fails closed (a legitimate user
 * sharing a NAT gets a spurious 429).
 *
 * Writing one row per attempt has no read-modify-write at all, so there
 * is no race to lose — no retry, no contention, no spurious lockout.
 * Counting is a bounded single-partition range query.
 *
 * It also upgrades the semantics from a fixed window to a true sliding
 * one. The old counter reset wholesale at the window boundary, so an
 * attacker could burn limit-1 attempts at the end of one window and a
 * full limit immediately after — effectively double the intended rate.
 *
 * ── Residual behaviour worth knowing ────────────────────────────────
 *
 * Counting happens before recording, so a burst of genuinely
 * simultaneous requests can overshoot the limit by the width of that
 * burst. The overshoot is bounded and self-corrects on the next request,
 * versus the old behaviour where parallelism bypassed the limit without
 * bound.
 *
 * Denied attempts are NOT recorded. That is deliberate: recording them
 * would let an attacker hold a victim's account locked indefinitely by
 * retrying just often enough to keep the window full.
 */

import {
  recordRateLimitAttempt,
  countRateLimitAttempts,
  clearRateLimitAttempts,
} from './tableStorage'

// Re-exported for the sweeper in functions/staleReservationCleanup.ts.
// See RATE_LIMIT_RETENTION_MS below for why it lives here.

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number // epoch ms
}

/**
 * How long attempt rows are kept before the sweeper deletes them.
 *
 * This lives here, next to the code that depends on it, because it is a
 * correctness constraint rather than a housekeeping preference: an
 * attempt row deleted while it is still inside someone's window silently
 * hands them a fresh budget. Retention must therefore always exceed the
 * longest window any caller passes.
 *
 * The sweeper in staleReservationCleanup.ts imports this rather than
 * declaring its own copy — two constants in two files that must agree,
 * with nothing enforcing it, is how this kind of bug ships.
 *
 * Longest window in use today is 60 min (per-account login lockouts),
 * so 2h carries a 2x margin.
 */
export const RATE_LIMIT_RETENTION_MS = 2 * 60 * 60 * 1000

/** Windows above this cannot be honoured under the current retention. */
export const MAX_SUPPORTED_WINDOW_MS = RATE_LIMIT_RETENTION_MS / 2

/**
 * Check the sliding window and record this attempt if it is allowed.
 *
 * @param key      Unique key, e.g. `login_fail:${email}` or `login:${ip}`
 * @param limit    Max attempts allowed within the window
 * @param windowMs Window duration in milliseconds
 */
export async function checkAndIncrement(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  // Guard against a future caller silently disabling its own limit by
  // asking for a window longer than rows are retained. Fails loudly at
  // the first call rather than quietly letting the limit reset early —
  // a rate limit that looks configured but does not hold is worse than
  // no rate limit, because nobody goes looking for it.
  if (windowMs > MAX_SUPPORTED_WINDOW_MS) {
    throw new Error(
      `[rateLimit] windowMs ${windowMs}ms for key "${key}" exceeds the ` +
        `${MAX_SUPPORTED_WINDOW_MS}ms supported by the current ` +
        `${RATE_LIMIT_RETENTION_MS}ms retention. Raise ` +
        `RATE_LIMIT_RETENTION_MS in services/rateLimit.ts before using a ` +
        `longer window.`,
    )
  }

  const now = Date.now()
  const windowStart = now - windowMs

  const used = await countRateLimitAttempts(key, windowStart)

  if (used >= limit) {
    return { allowed: false, remaining: 0, resetAt: now + windowMs }
  }

  await recordRateLimitAttempt(key, now)

  return {
    allowed: true,
    remaining: Math.max(0, limit - (used + 1)),
    resetAt: now + windowMs,
  }
}

/**
 * Clear a key's attempt history. Called after a successful login so a
 * legitimate user who fumbled their password a few times isn't left
 * near the limit. Best-effort — a failure here is swallowed because the
 * caller's action (login success) has already happened.
 */
export async function resetRateLimit(key: string): Promise<void> {
  try {
    await clearRateLimitAttempts(key)
  } catch {
    // Rows may already be gone (never created, or swept) — that's fine.
  }
}
