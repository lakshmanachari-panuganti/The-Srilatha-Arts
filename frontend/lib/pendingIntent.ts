/**
 * Pending-intent utility for the "click add → forced login → auto-replay
 * after auth" flow. Lives in sessionStorage so it survives the redirect
 * to /login (and back) but never leaks across browser tabs or sessions.
 *
 * The full Product object is stored (not just the id) so the post-login
 * replay can complete without an extra `/api/products/{id}` round-trip.
 * Stale intents (>15 min) are ignored — if the user takes that long to
 * sign in, the original intent has very likely lost its context.
 */

import type { Product } from '@/types'

const KEY = 'tsa_pending_intent'
const MAX_AGE_MS = 15 * 60 * 1000

export type IntentType = 'cart' | 'wishlist'

export interface PendingIntent {
  type: IntentType
  product: Product
  /** Only meaningful for cart intents; ignored for wishlist. */
  qty?: number
  /** ISO timestamp set at queue time; used to discard stale intents. */
  queuedAt: string
}

export function setPendingIntent(intent: Omit<PendingIntent, 'queuedAt'>): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ ...intent, queuedAt: new Date().toISOString() }),
    )
  } catch {
    // QuotaExceeded or storage disabled — silently no-op. The user will
    // just need to repeat the action after signing in.
  }
}

/** Read + remove. Use this when actually replaying the intent. */
export function consumePendingIntent(): PendingIntent | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    sessionStorage.removeItem(KEY)
    const intent = JSON.parse(raw) as PendingIntent
    if (!intent.product || !intent.type) return null
    if (Date.now() - new Date(intent.queuedAt).getTime() > MAX_AGE_MS) return null
    return intent
  } catch {
    return null
  }
}

/** Read without removing. Use this to show context on the login page. */
export function peekPendingIntent(): PendingIntent | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const intent = JSON.parse(raw) as PendingIntent
    if (Date.now() - new Date(intent.queuedAt).getTime() > MAX_AGE_MS) {
      sessionStorage.removeItem(KEY)
      return null
    }
    return intent
  } catch {
    return null
  }
}

export function clearPendingIntent(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(KEY)
  } catch {}
}
