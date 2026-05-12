'use client'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Product, WishlistItem } from '@/types'

interface WishlistState {
  items: WishlistItem[]
  has: (productId: string) => boolean
  toggle: (product: Product) => void
  remove: (productId: string) => void
  clear: () => void
}

export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      has: (productId) => get().items.some((i) => i.productId === productId),
      toggle: (product) =>
        set((s) => {
          const exists = s.items.find((i) => i.productId === product.id)
          if (exists) {
            return { items: s.items.filter((i) => i.productId !== product.id) }
          }
          return {
            items: [
              ...s.items,
              {
                productId: product.id,
                slug: product.slug,
                title: product.title,
                price: product.price,
                image: product.images[0],
                category: product.category,
                addedAt: new Date().toISOString(),
              },
            ],
          }
        }),
      remove: (productId) =>
        set((s) => ({ items: s.items.filter((i) => i.productId !== productId) })),
      clear: () => set({ items: [] }),
    }),
    {
      name: 'tsa_wishlist',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ items: s.items }),
    },
  ),
)
