'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useCart } from '@/stores/cart'
import { useUserAuth } from '@/stores/userAuth'
import { useToast } from '@/stores/toast'
import { setPendingIntent } from '@/lib/pendingIntent'
import type { Product } from '@/types'

// Brief pause between showing the toast and navigating away, so the
// "Redirecting…" message is visible long enough to read. Matches the
// equivalent gap in useToggleWishlist.
const REDIRECT_DELAY_MS = 700

/**
 * Centralised "add to cart" handler.
 *
 * Single auth gate for the product card, PDP, and sticky-cart-bar.
 * Behaviour for anonymous users (per spec):
 *   1. Show a toast: "You are not logged in yet. Redirecting to the
 *      login page..."
 *   2. Queue a pending intent in sessionStorage carrying the full
 *      Product + qty.
 *   3. Navigate to /login?next=<current path>.
 *   4. After successful login, LoginClient consumes the intent and
 *      replays the add automatically — the user does NOT need to repeat
 *      the action.
 *
 * The cart store itself stays auth-agnostic (still just a data structure).
 * Existing unit tests continue to work since they invoke the store
 * directly, not this hook.
 */
export function useAddToCart() {
  const router = useRouter()
  const pathname = usePathname()
  const add = useCart((s) => s.add)
  const open = useCart((s) => s.open)
  const user = useUserAuth((s) => s.user)
  const showToast = useToast((s) => s.show)

  return {
    isAuthed: Boolean(user),
    /**
     * Returns true if the item was added, false if the caller was sent to
     * the login flow instead. Callers should bail out of any follow-up
     * navigation (e.g. "Buy Now") when this returns false.
     */
    addToCart(product: Product, qty = 1, opts?: { openDrawer?: boolean }): boolean {
      if (!user) {
        showToast({
          message: 'You are not logged in yet. Redirecting to the login page...',
          kind: 'info',
          durationMs: 2500,
        })
        setPendingIntent({ type: 'cart', product, qty })
        const next = pathname || '/shop'
        // Tiny delay so the toast is visible BEFORE the page unmounts.
        // setTimeout is intentional: router.push is fast and would
        // unmount the toast container before the user reads it.
        window.setTimeout(() => {
          router.push(`/login?next=${encodeURIComponent(next)}`)
        }, REDIRECT_DELAY_MS)
        return false
      }
      add(product, qty)
      if (opts?.openDrawer) open()
      return true
    },
  }
}
