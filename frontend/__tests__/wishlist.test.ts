/**
 * Unit tests for stores/wishlist.ts
 *
 * Tests toggle (add/remove), has, remove, and clear actions.
 * State is reset before each test to prevent cross-test contamination.
 */

import { useWishlist } from '../stores/wishlist'
import type { Product } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    slug: 'test-product',
    title: 'Test Product',
    category: 'resin',
    price: 1500,
    size: '8x8 inch',
    material: 'Resin',
    timeToMake: '7 days',
    description: 'A beautiful resin art piece',
    shortDescription: 'Resin art',
    careInstructions: 'Avoid direct sunlight',
    images: ['https://example.com/img.jpg'],
    inStock: true,
    stockQty: 5,
    featured: false,
    isNewArrival: true,
    isBestSeller: false,
    isOnSale: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

// Reset store and localStorage before every test
beforeEach(() => {
  useWishlist.setState({ items: [] })
  localStorage.clear()
})

// ─── has ──────────────────────────────────────────────────────────────────────

describe('useWishlist — has', () => {
  it('returns false for an empty wishlist', () => {
    expect(useWishlist.getState().has('prod-1')).toBe(false)
  })

  it('returns true after a product is added', () => {
    useWishlist.getState().toggle(makeProduct())
    expect(useWishlist.getState().has('prod-1')).toBe(true)
  })

  it('returns false after a product is removed', () => {
    useWishlist.getState().toggle(makeProduct())
    useWishlist.getState().remove('prod-1')
    expect(useWishlist.getState().has('prod-1')).toBe(false)
  })
})

// ─── toggle ───────────────────────────────────────────────────────────────────

describe('useWishlist — toggle', () => {
  it('adds a product when it is not in the wishlist', () => {
    useWishlist.getState().toggle(makeProduct())
    expect(useWishlist.getState().items).toHaveLength(1)
    expect(useWishlist.getState().items[0].productId).toBe('prod-1')
  })

  it('removes a product when it is already in the wishlist', () => {
    const product = makeProduct()
    useWishlist.getState().toggle(product)
    useWishlist.getState().toggle(product)
    expect(useWishlist.getState().items).toHaveLength(0)
  })

  it('stores correct product details when adding', () => {
    const product = makeProduct({ title: 'Dot Mandala', price: 2000 })
    useWishlist.getState().toggle(product)
    const item = useWishlist.getState().items[0]
    expect(item.title).toBe('Dot Mandala')
    expect(item.price).toBe(2000)
    expect(item.image).toBe('https://example.com/img.jpg')
    expect(item.slug).toBe('test-product')
    expect(item.category).toBe('resin')
  })

  it('stores an addedAt ISO timestamp', () => {
    useWishlist.getState().toggle(makeProduct())
    const { addedAt } = useWishlist.getState().items[0]
    expect(new Date(addedAt).getTime()).not.toBeNaN()
  })

  it('can have multiple different products', () => {
    useWishlist.getState().toggle(makeProduct({ id: 'a', slug: 'a' }))
    useWishlist.getState().toggle(makeProduct({ id: 'b', slug: 'b' }))
    expect(useWishlist.getState().items).toHaveLength(2)
  })

  it('only removes the toggled product, not others', () => {
    const p1 = makeProduct({ id: 'a', slug: 'a' })
    const p2 = makeProduct({ id: 'b', slug: 'b' })
    useWishlist.getState().toggle(p1)
    useWishlist.getState().toggle(p2)
    useWishlist.getState().toggle(p1) // remove p1
    expect(useWishlist.getState().items).toHaveLength(1)
    expect(useWishlist.getState().items[0].productId).toBe('b')
  })
})

// ─── remove ───────────────────────────────────────────────────────────────────

describe('useWishlist — remove', () => {
  it('removes the specified product', () => {
    useWishlist.getState().toggle(makeProduct())
    useWishlist.getState().remove('prod-1')
    expect(useWishlist.getState().items).toHaveLength(0)
  })

  it('is a no-op when productId does not exist', () => {
    useWishlist.getState().toggle(makeProduct())
    useWishlist.getState().remove('nonexistent')
    expect(useWishlist.getState().items).toHaveLength(1)
  })

  it('only removes the matching item when multiple exist', () => {
    useWishlist.getState().toggle(makeProduct({ id: 'a', slug: 'a' }))
    useWishlist.getState().toggle(makeProduct({ id: 'b', slug: 'b' }))
    useWishlist.getState().remove('a')
    expect(useWishlist.getState().items).toHaveLength(1)
    expect(useWishlist.getState().items[0].productId).toBe('b')
  })
})

// ─── clear ────────────────────────────────────────────────────────────────────

describe('useWishlist — clear', () => {
  it('removes all items', () => {
    useWishlist.getState().toggle(makeProduct({ id: 'a', slug: 'a' }))
    useWishlist.getState().toggle(makeProduct({ id: 'b', slug: 'b' }))
    useWishlist.getState().clear()
    expect(useWishlist.getState().items).toHaveLength(0)
  })

  it('is a no-op on an already empty wishlist', () => {
    useWishlist.getState().clear()
    expect(useWishlist.getState().items).toHaveLength(0)
  })
})
