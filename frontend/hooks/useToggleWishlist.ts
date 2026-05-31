'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useWishlist } from '@/stores/wishlist'
import { useUserAuth } from '@/stores/userAuth'
import { useToast } from '@/stores/toast'
import { setPendingIntent } from '@/lib/pendingIntent'
import type { Product } from '@/types'

const REDIRECT_DELAY_MS = 700

/**
 * Auth-gated wishlist toggle.
 *
 * Spec: "if a user tries to add an item to the Wishlist while not
 * logged in, redirect them to login and automatically add the item
 * after authentication." Mirrors useAddToCart exactly so the two
 * surfaces feel identical.
 *
 * The wishlist store stays a pure data structure (no router/auth
 * imports). Components that want the spec'd behaviour use this hook;
 * legacy callers (none currently) can still hit the store directly.
 */
export function useToggleWishlist() {
  const router = useRouter()
  const pathname = usePathname()
  const toggle = useWishlist((s) => s.toggle)
  const has = useWishlist((s) => s.has)
  const user = useUserAuth((s) => s.user)
  const showToast = useToast((s) => s.show)

  return {
    isAuthed: Boolean(user),
    /**
     * Returns true if the toggle was applied locally, false if the
     * caller was redirected to the login flow. Callers usually don't
     * need the return value — the visual heart icon flips based on
     * `useWishlist((s) => s.has(...))` and refreshes automatically.
     */
    toggleWishlist(product: Product): boolean {
      if (user) {
        toggle(product)
        return true
      }
      // Anonymous + removing a locally-cached item: just remove locally.
      // The spec only requires the redirect when ADDING.
      if (has(product.id)) {
        toggle(product)
        return true
      }
      // Anonymous + adding: forced login + replay.
      showToast({
        message: 'You are not logged in yet. Redirecting to the login page...',
        kind: 'info',
        durationMs: 2500,
      })
      setPendingIntent({ type: 'wishlist', product })
      const next = pathname || '/shop'
      window.setTimeout(() => {
        router.push(`/login?next=${encodeURIComponent(next)}`)
      }, REDIRECT_DELAY_MS)
      return false
    },
  }
}
