'use client'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { apiFetch, ApiError } from '@/lib/api'
import type { Product, WishlistItem, CategorySlug } from '@/types'

interface WishlistState {
  items: WishlistItem[]
  /** True once we've finished pulling server state for the current user. */
  hydrated: boolean
  has: (productId: string) => boolean
  toggle: (product: Product) => void
  remove: (productId: string) => void
  /** Wipe local state. Called on logout so the next user on the same
   *  browser doesn't inherit the previous user's wishlist. */
  clear: () => void
  /** Merge any local items into the server wishlist, then replace local
   *  state with the server response. No-op if no user token is set
   *  (anonymous browsing keeps localStorage-only behaviour). */
  hydrateFromServer: () => Promise<void>
}

// Shape returned by GET /api/wishlist (matches WishlistItem after the
// enrichment update on the backend).
interface ServerWishlistItem {
  productId: string
  slug: string
  title: string
  category: string
  image: string
  price: number
  /** Strikethrough "was" price — undefined when not on sale. */
  compareAtPrice?: number
  inStock: boolean
  addedAt: string
}

let _hydrateInFlight: Promise<void> | null = null

export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      hydrated: false,
      has: (productId) => get().items.some((i) => i.productId === productId),

      toggle: (product) => {
        const exists = get().items.find((i) => i.productId === product.id)
        if (exists) {
          set((s) => ({ items: s.items.filter((i) => i.productId !== product.id) }))
          // Best-effort server sync — never block the UI on a network error.
          // Anonymous users (no token) hit a 401 here, which is fine: the
          // local optimistic update already happened.
          apiFetch(`/wishlist/${encodeURIComponent(product.id)}`, { method: 'DELETE' }).catch(
            silenceAuthErrors,
          )
          return
        }
        const item: WishlistItem = {
          productId: product.id,
          slug: product.slug,
          title: product.title,
          price: product.price,
          compareAtPrice: product.compareAtPrice,
          image: product.images[0],
          category: product.category,
          addedAt: new Date().toISOString(),
        }
        set((s) => ({ items: [...s.items, item] }))
        apiFetch('/wishlist', { method: 'POST', body: { productId: product.id } }).catch(
          silenceAuthErrors,
        )
      },

      remove: (productId) => {
        set((s) => ({ items: s.items.filter((i) => i.productId !== productId) }))
        apiFetch(`/wishlist/${encodeURIComponent(productId)}`, { method: 'DELETE' }).catch(
          silenceAuthErrors,
        )
      },

      clear: () => set({ items: [], hydrated: false }),

      hydrateFromServer: async () => {
        // Deduplicate concurrent calls (e.g. login + onRehydrate firing
        // back-to-back). Multiple consumers share the same in-flight promise.
        if (_hydrateInFlight) return _hydrateInFlight
        _hydrateInFlight = (async () => {
          try {
            // Upload local items first so anonymous additions survive login.
            // Server POST is naturally idempotent (same partition/row key).
            const local = get().items
            await Promise.all(
              local.map((it) =>
                apiFetch('/wishlist', { method: 'POST', body: { productId: it.productId } }).catch(
                  silenceAuthErrors,
                ),
              ),
            )
            const res = await apiFetch<{ items: ServerWishlistItem[] }>('/wishlist')
            const items: WishlistItem[] = (res.items || []).map((it) => ({
              productId: it.productId,
              slug: it.slug,
              title: it.title,
              image: it.image,
              price: it.price,
              compareAtPrice: it.compareAtPrice,
              category: (it.category || '') as CategorySlug,
              addedAt: it.addedAt,
            }))
            set({ items, hydrated: true })
          } catch (err) {
            // 401 = no token (anonymous browsing). Keep local items.
            if (err instanceof ApiError && err.status === 401) {
              set({ hydrated: false })
              return
            }
            // Anything else: keep local state, mark not-hydrated so a future
            // call retries.
            set({ hydrated: false })
          } finally {
            _hydrateInFlight = null
          }
        })()
        return _hydrateInFlight
      },
    }),
    {
      name: 'tsa_wishlist',
      storage: createJSONStorage(() => localStorage),
      // Persist items + hydrated flag so quick page navigations don't
      // re-fetch. The flag is cleared on logout/login transitions by the
      // userAuth store.
      partialize: (s) => ({ items: s.items, hydrated: s.hydrated }),
    },
  ),
)

function silenceAuthErrors(err: unknown) {
  if (err instanceof ApiError && err.status === 401) return
  // Anything else is a real failure but we deliberately don't surface
  // wishlist sync errors to the user — the UI is already updated.
}
