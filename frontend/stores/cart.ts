'use client'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { apiFetch, ApiError } from '@/lib/api'
import type { CartItem, CategorySlug, Product } from '@/types'

interface CartState {
  items: CartItem[]
  isOpen: boolean
  hydrated: boolean
  add: (product: Product, qty?: number) => void
  remove: (productId: string) => void
  setQty: (productId: string, qty: number) => void
  clear: () => void
  open: () => void
  close: () => void
  toggle: () => void
  /** Pull the server cart for the authenticated user, replacing local
   *  state. Anonymous callers (no token) keep their local cart. */
  hydrateFromServer: () => Promise<void>
  _setHydrated: () => void
}

interface ServerCartItem {
  productId: string
  quantity: number
  addedAt: string
  title: string
  slug: string
  category: string
  image: string
  price: number
  compareAtPrice?: number
  size: string
  inStock: boolean
}

let _hydrateInFlight: Promise<void> | null = null

function silenceAuthErrors(err: unknown) {
  if (err instanceof ApiError && err.status === 401) return
  // Anything else (5xx, 404, network) is a real failure. We deliberately
  // don't surface it as a toast - the optimistic local update already
  // gave the user feedback - but log it so devs can see when sync is
  // silently broken (e.g. a table missing in Azure). Visible in DevTools
  // console, no impact on production users.
  if (typeof console !== 'undefined') {
    // eslint-disable-next-line no-console
    console.warn('[cart] background sync failed', err)
  }
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      hydrated: false,
      add: (product, qty = 1) => {
        // Local optimistic update first. Auth gating is enforced one
        // layer up (useAddToCart) - by the time we get here the caller
        // has confirmed there's a user, or we're replaying an intent
        // post-login.
        set((s) => {
          const existing = s.items.find((i) => i.productId === product.id)
          if (existing) {
            return {
              items: s.items.map((i) =>
                i.productId === product.id ? { ...i, quantity: i.quantity + qty } : i,
              ),
            }
          }
          return {
            items: [
              ...s.items,
              {
                productId: product.id,
                slug: product.slug,
                title: product.title,
                category: product.category,
                price: product.price,
                compareAtPrice: product.compareAtPrice,
                image: product.images[0],
                size: product.size,
                quantity: qty,
              },
            ],
          }
        })
        // Best-effort server sync. Anonymous → 401 silenced.
        apiFetch('/cart', { method: 'POST', body: { productId: product.id, quantity: qty } }).catch(
          silenceAuthErrors,
        )
      },
      remove: (productId) => {
        set((s) => ({ items: s.items.filter((i) => i.productId !== productId) }))
        apiFetch(`/cart/${encodeURIComponent(productId)}`, { method: 'DELETE' }).catch(
          silenceAuthErrors,
        )
      },
      setQty: (productId, qty) => {
        set((s) => ({
          items:
            qty <= 0
              ? s.items.filter((i) => i.productId !== productId)
              : s.items.map((i) =>
                  i.productId === productId ? { ...i, quantity: qty } : i,
                ),
        }))
        apiFetch(`/cart/${encodeURIComponent(productId)}`, {
          method: 'PATCH',
          body: { quantity: qty },
        }).catch(silenceAuthErrors)
      },
      clear: () => {
        set({ items: [], hydrated: false })
        // After successful checkout we also want the server cart cleared.
        // No-op for anonymous (401 silenced).
        apiFetch('/cart', { method: 'DELETE' }).catch(silenceAuthErrors)
      },
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      toggle: () => set((s) => ({ isOpen: !s.isOpen })),
      hydrateFromServer: async () => {
        if (_hydrateInFlight) return _hydrateInFlight
        _hydrateInFlight = (async () => {
          try {
            // Upload any local items first so additions made between deploys
            // (or in an exotic anonymous-cart path) survive sign-in. Server
            // POST is idempotent on the composite key and increments quantity,
            // which is the right merge behaviour for cart items.
            const local = get().items
            await Promise.all(
              local.map((it) =>
                apiFetch('/cart', {
                  method: 'POST',
                  body: { productId: it.productId, quantity: it.quantity },
                }).catch(silenceAuthErrors),
              ),
            )
            const res = await apiFetch<{ items: ServerCartItem[] }>('/cart')
            const items: CartItem[] = (res.items || []).map((it) => ({
              productId: it.productId,
              slug: it.slug,
              title: it.title,
              category: (it.category || '') as CategorySlug,
              price: it.price,
              compareAtPrice: it.compareAtPrice,
              image: it.image,
              size: it.size || '',
              quantity: it.quantity,
            }))
            set({ items, hydrated: true })
          } catch (err) {
            // Anonymous → 401 means there's no server cart to pull. Keep
            // whatever local state we had.
            if (err instanceof ApiError && err.status === 401) {
              set({ hydrated: false })
              return
            }
            set({ hydrated: false })
          } finally {
            _hydrateInFlight = null
          }
        })()
        return _hydrateInFlight
      },
      _setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: 'tsa_cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ items: s.items }),
      onRehydrateStorage: () => (state) => {
        state?._setHydrated()
      },
    },
  ),
)

export const cartCount = (items: CartItem[]) =>
  items.reduce((sum, i) => sum + i.quantity, 0)

export const cartSubtotal = (items: CartItem[]) =>
  items.reduce((sum, i) => sum + i.price * i.quantity, 0)
