'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useCart } from '@/stores/cart'
import { useUserAuth } from '@/stores/userAuth'
import type { Product } from '@/types'

/**
 * Centralised "add to cart" handler.
 *
 * The product page, product card, and sticky-cart-bar all need the same
 * auth gate: if the user isn't signed in, send them through the login flow
 * with `?next=…` so they land back where they were after authenticating.
 * Keeping the gate in one hook means every entry point gets the behaviour
 * automatically — there's no way to forget to add it.
 *
 * The cart store itself stays auth-agnostic (it's just a data structure),
 * which is also what the existing unit tests expect.
 */
export function useAddToCart() {
  const router = useRouter()
  const pathname = usePathname()
  const add = useCart((s) => s.add)
  const open = useCart((s) => s.open)
  const user = useUserAuth((s) => s.user)

  return {
    isAuthed: Boolean(user),
    /**
     * Returns true if the item was added, false if the caller was sent to
     * the login flow instead. Callers should bail out of any follow-up
     * navigation (e.g. "Buy Now") when this returns false.
     */
    addToCart(product: Product, qty = 1, opts?: { openDrawer?: boolean }): boolean {
      if (!user) {
        const next = pathname || '/shop'
        router.push(`/login?next=${encodeURIComponent(next)}`)
        return false
      }
      add(product, qty)
      if (opts?.openDrawer) open()
      return true
    },
  }
}
