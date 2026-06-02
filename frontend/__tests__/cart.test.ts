/**
 * Unit tests for stores/cart.ts
 *
 * Tests:
 *  - Pure exported functions: cartCount, cartSubtotal
 *  - Zustand store actions: add, remove, setQty, clear, open/close/toggle
 *
 * The persist middleware uses localStorage (provided by jsdom).
 * State is reset before each test to prevent cross-test contamination.
 */

import { useCart, cartCount, cartSubtotal } from '../stores/cart'
import type { Product } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    slug: 'test-product',
    title: 'Test Product',
    category: 'resin',
    price: 1000,
    size: '6x6 inch',
    material: 'Resin',
    timeToMake: '5 days',
    description: 'A test product',
    shortDescription: 'Test',
    careInstructions: 'Handle with care',
    images: ['https://example.com/img.jpg'],
    inStock: true,
    stockQty: 10,
    featured: false,
    isNewArrival: false,
    isBestSeller: false,
    isOnSale: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

// Reset store and localStorage before every test
beforeEach(() => {
  useCart.setState({ items: [], isOpen: false, hydrated: false })
  localStorage.clear()
})

// ─── cartCount (pure function) ────────────────────────────────────────────────

describe('cartCount', () => {
  it('returns 0 for empty items', () => {
    expect(cartCount([])).toBe(0)
  })

  it('sums quantities across all items', () => {
    const items = [
      { productId: 'a', quantity: 2 } as any,
      { productId: 'b', quantity: 3 } as any,
    ]
    expect(cartCount(items)).toBe(5)
  })

  it('handles a single item', () => {
    expect(cartCount([{ productId: 'x', quantity: 7 } as any])).toBe(7)
  })
})

// ─── cartSubtotal (pure function) ─────────────────────────────────────────────

describe('cartSubtotal', () => {
  it('returns 0 for empty items', () => {
    expect(cartSubtotal([])).toBe(0)
  })

  it('calculates price × quantity for a single item', () => {
    expect(cartSubtotal([{ price: 500, quantity: 3 } as any])).toBe(1500)
  })

  it('sums across multiple items', () => {
    const items = [
      { price: 1000, quantity: 2 } as any,
      { price: 500, quantity: 1 } as any,
    ]
    expect(cartSubtotal(items)).toBe(2500)
  })
})

// ─── useCart store - add ──────────────────────────────────────────────────────

describe('useCart - add', () => {
  it('adds a new product to an empty cart', () => {
    const product = makeProduct()
    useCart.getState().add(product)
    expect(useCart.getState().items).toHaveLength(1)
    expect(useCart.getState().items[0].productId).toBe('prod-1')
    expect(useCart.getState().items[0].quantity).toBe(1)
  })

  it('uses qty=1 by default', () => {
    useCart.getState().add(makeProduct())
    expect(useCart.getState().items[0].quantity).toBe(1)
  })

  it('uses the provided qty', () => {
    useCart.getState().add(makeProduct(), 3)
    expect(useCart.getState().items[0].quantity).toBe(3)
  })

  it('increments quantity when the same product is added again', () => {
    const product = makeProduct()
    useCart.getState().add(product)
    useCart.getState().add(product)
    expect(useCart.getState().items).toHaveLength(1)
    expect(useCart.getState().items[0].quantity).toBe(2)
  })

  it('increments by the specified qty when product already exists', () => {
    const product = makeProduct()
    useCart.getState().add(product, 2)
    useCart.getState().add(product, 3)
    expect(useCart.getState().items[0].quantity).toBe(5)
  })

  it('adds different products as separate line items', () => {
    useCart.getState().add(makeProduct({ id: 'prod-1' }))
    useCart.getState().add(makeProduct({ id: 'prod-2', slug: 'product-2' }))
    expect(useCart.getState().items).toHaveLength(2)
  })

  it('stores the correct title, price, and image', () => {
    const product = makeProduct({ title: 'Resin Art', price: 2500 })
    useCart.getState().add(product)
    const item = useCart.getState().items[0]
    expect(item.title).toBe('Resin Art')
    expect(item.price).toBe(2500)
    expect(item.image).toBe('https://example.com/img.jpg')
  })
})

// ─── useCart store - remove ───────────────────────────────────────────────────

describe('useCart - remove', () => {
  it('removes an item by productId', () => {
    useCart.getState().add(makeProduct({ id: 'prod-1' }))
    useCart.getState().remove('prod-1')
    expect(useCart.getState().items).toHaveLength(0)
  })

  it('only removes the matching item when multiple exist', () => {
    useCart.getState().add(makeProduct({ id: 'prod-1' }))
    useCart.getState().add(makeProduct({ id: 'prod-2', slug: 'p2' }))
    useCart.getState().remove('prod-1')
    expect(useCart.getState().items).toHaveLength(1)
    expect(useCart.getState().items[0].productId).toBe('prod-2')
  })

  it('does nothing when productId does not exist', () => {
    useCart.getState().add(makeProduct())
    useCart.getState().remove('nonexistent')
    expect(useCart.getState().items).toHaveLength(1)
  })
})

// ─── useCart store - setQty ───────────────────────────────────────────────────

describe('useCart - setQty', () => {
  it('updates quantity for an existing item', () => {
    useCart.getState().add(makeProduct())
    useCart.getState().setQty('prod-1', 5)
    expect(useCart.getState().items[0].quantity).toBe(5)
  })

  it('removes item when qty is set to 0', () => {
    useCart.getState().add(makeProduct())
    useCart.getState().setQty('prod-1', 0)
    expect(useCart.getState().items).toHaveLength(0)
  })

  it('removes item when qty is set to a negative number', () => {
    useCart.getState().add(makeProduct())
    useCart.getState().setQty('prod-1', -1)
    expect(useCart.getState().items).toHaveLength(0)
  })

  it('does nothing when productId does not exist', () => {
    useCart.getState().add(makeProduct())
    useCart.getState().setQty('nonexistent', 3)
    expect(useCart.getState().items).toHaveLength(1)
    expect(useCart.getState().items[0].quantity).toBe(1)
  })
})

// ─── useCart store - clear ────────────────────────────────────────────────────

describe('useCart - clear', () => {
  it('empties all items', () => {
    useCart.getState().add(makeProduct({ id: 'a' }))
    useCart.getState().add(makeProduct({ id: 'b', slug: 'b' }))
    useCart.getState().clear()
    expect(useCart.getState().items).toHaveLength(0)
  })

  it('is a no-op on an already empty cart', () => {
    useCart.getState().clear()
    expect(useCart.getState().items).toHaveLength(0)
  })
})

// ─── useCart store - open / close / toggle ────────────────────────────────────

describe('useCart - open / close / toggle', () => {
  it('starts closed', () => {
    expect(useCart.getState().isOpen).toBe(false)
  })

  it('open() sets isOpen to true', () => {
    useCart.getState().open()
    expect(useCart.getState().isOpen).toBe(true)
  })

  it('close() sets isOpen to false', () => {
    useCart.getState().open()
    useCart.getState().close()
    expect(useCart.getState().isOpen).toBe(false)
  })

  it('toggle() flips isOpen from false to true', () => {
    useCart.getState().toggle()
    expect(useCart.getState().isOpen).toBe(true)
  })

  it('toggle() flips isOpen from true to false', () => {
    useCart.getState().open()
    useCart.getState().toggle()
    expect(useCart.getState().isOpen).toBe(false)
  })
})
