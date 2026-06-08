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
   *  state. Anonymous callers (no token) keep their local cart.
   *  Pass `{ mergeLocal: true }` ONLY on the anonymous→login transition
   *  to upload local items into the server cart first. On page-reload
   *  rehydration the local items already came from the server, so
   *  re-uploading them would double-count (POST /cart is increment). */
  hydrateFromServer: (opts?: { mergeLocal?: boolean }) => Promise<void>
  /** Re-fetch the live product price for every line item and update the
   *  store in place. Returns the list of items whose price changed so the
   *  caller can surface a notice. Anonymous users see this too — server
   *  is the authoritative price source even before login. */
  refreshPrices: () => Promise<{ productId: string; title: string; oldPrice: number; newPrice: number }[]>
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
      hydrateFromServer: async (opts) => {
        if (_hydrateInFlight) return _hydrateInFlight
        const mergeLocal = opts?.mergeLocal === true
        _hydrateInFlight = (async () => {
          try {
            if (mergeLocal) {
              // Anonymous→login merge only. POST /cart is increment, so
              // running this on plain page-reload rehydration would double
              // the quantity on every refresh.
              const local = get().items
              await Promise.all(
                local.map((it) =>
                  apiFetch('/cart', {
                    method: 'POST',
                    body: { productId: it.productId, quantity: it.quantity },
                  }).catch(silenceAuthErrors),
                ),
              )
            }
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
      refreshPrices: async () => {
        const items = get().items
        if (items.length === 0) return []
        // One product fetch per line item. At cart size <10 (typical for
        // handcrafted single-piece carts) this is cheaper than building a
        // batched endpoint. Sequential errors are swallowed — a single
        // network blip shouldn't blow away the user's cart UI.
        const changes: { productId: string; title: string; oldPrice: number; newPrice: number }[] = []
        const fresh = await Promise.all(
          items.map(async (it) => {
            try {
              const { product } = await apiFetch<{ product: Product }>(`/products/${encodeURIComponent(it.productId)}`)
              if (typeof product.price === 'number' && product.price !== it.price) {
                changes.push({
                  productId: it.productId,
                  title: it.title,
                  oldPrice: it.price,
                  newPrice: product.price,
                })
                return { ...it, price: product.price, compareAtPrice: product.compareAtPrice }
              }
              return it
            } catch {
              return it
            }
          }),
        )
        if (changes.length > 0) set({ items: fresh })
        return changes
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
