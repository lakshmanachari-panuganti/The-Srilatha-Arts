/**
 * 2. Backend API Tests - validate every ✅ backend endpoint.
 * Uses page.request (browser-routed) so ignoreHTTPSErrors applies.
 */
import { test, expect } from '@playwright/test'
import { adminLogin, customerLogin, API_URL } from './helpers'

// ─── Phase 1: Public Endpoints ──────────────────────────────────────────────

test.describe('Public endpoints', () => {
  test('GET /announcements → 200 array', async ({ page }) => {
    const res = await page.request.get(`${API_URL}/announcements`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body) || Array.isArray(body.announcements)).toBeTruthy()
  })

  test('GET /products → 200 with products array', async ({ page }) => {
    const res = await page.request.get(`${API_URL}/products`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.products)).toBeTruthy()
    expect(body.products.length).toBeGreaterThanOrEqual(0)
  })

  test('GET /products?category=dot-mandala → filters correctly', async ({ page }) => {
    const res = await page.request.get(`${API_URL}/products?category=dot-mandala`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    for (const p of body.products) {
      expect(p.category).toBe('dot-mandala')
    }
  })

  test('GET /products/:id → 200 for first product', async ({ page }) => {
    const list = await (await page.request.get(`${API_URL}/products`)).json()
    if (!list.products?.length) { test.skip() }
    const id = list.products[0].id
    const res = await page.request.get(`${API_URL}/products/${id}`)
    expect(res.status()).toBe(200)
    const p = await res.json()
    expect(p.id).toBe(id)
  })

  test('GET /products/:bad-id → 404', async ({ page }) => {
    const res = await page.request.get(`${API_URL}/products/nonexistent-product-99999`)
    expect(res.status()).toBe(404)
  })
})

// ─── Phase 2: Auth Endpoints ────────────────────────────────────────────────

test.describe('Auth endpoints', () => {
  test('POST /auth/admin/login with correct creds → 200 + token', async ({ page }) => {
    const token = await adminLogin(page)
    expect(token.length).toBeGreaterThan(10)
  })

  test('POST /auth/admin/login with wrong password → 401', async ({ page }) => {
    const res = await page.request.post(`${API_URL}/auth/admin/login`, {
      data: { username: 'test@srilatha.art', password: 'wrongpassword' },
    })
    expect(res.status()).toBe(401)
  })

  test('POST /auth/login (customer) with correct creds → 200 + token', async ({ page }) => {
    const token = await customerLogin(page)
    expect(token.length).toBeGreaterThan(10)
  })

  test('POST /auth/login with wrong password → 401', async ({ page }) => {
    const res = await page.request.post(`${API_URL}/auth/login`, {
      data: { email: 'testuser@srilatha.art', password: 'wrongpass' },
    })
    expect(res.status()).toBe(401)
  })

  test('GET /auth/me with token → 200 with user email', async ({ page }) => {
    const token = await customerLogin(page)
    const res = await page.request.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    // Backend wraps in { user: { email, name, ... } }
    expect(body.user?.email).toBe('testuser@srilatha.art')
  })

  test('GET /auth/me without token → 200 with user: null (SPA hydration design)', async ({ page }) => {
    const res = await page.request.get(`${API_URL}/auth/me`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    // By design: unauthenticated returns 200 + { user: null } for SPA hydration
    expect(body.user).toBeNull()
  })

  test('GET /auth/csrf → 200 with csrfToken', async ({ page }) => {
    const res = await page.request.get(`${API_URL}/auth/csrf`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.csrfToken).toBeTruthy()
  })
})

// ─── Phase 2: Orders ────────────────────────────────────────────────────────

test.describe('Orders endpoints', () => {
  test('GET /my-orders (customer) → 200 with orders array', async ({ page }) => {
    const token = await customerLogin(page)
    const res = await page.request.get(`${API_URL}/my-orders`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.orders)).toBeTruthy()
  })

  test('GET /my-orders without auth → 401', async ({ page }) => {
    const res = await page.request.get(`${API_URL}/my-orders`)
    expect(res.status()).toBe(401)
  })

  test('GET /orders/:nonexistent → 404', async ({ page }) => {
    const token = await customerLogin(page)
    const res = await page.request.get(`${API_URL}/orders/TSA-0000-00000`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status()).toBe(404)
  })
})

// ─── Phase 2: Coupons ───────────────────────────────────────────────────────

test.describe('Coupons endpoints', () => {
  test('POST /coupons/validate with invalid code → 200 valid:false', async ({ page }) => {
    const res = await page.request.post(`${API_URL}/coupons/validate`, {
      data: { code: 'NOSUCHCODE', orderAmount: 50000 },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.valid).toBe(false)
    expect(body.reason).toBe('INVALID')
  })

  test('GET /coupons/active → 200', async ({ page }) => {
    const res = await page.request.get(`${API_URL}/coupons/active`)
    expect(res.status()).toBe(200)
  })
})

// ─── Phase 3: Reviews ───────────────────────────────────────────────────────

test.describe('Reviews endpoints', () => {
  test('GET /reviews/product/:id → 200 array', async ({ page }) => {
    const res = await page.request.get(`${API_URL}/reviews/product/lippan-34cb30c7`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body) || Array.isArray(body.reviews)).toBeTruthy()
  })

  test('POST /reviews without auth → 401', async ({ page }) => {
    const res = await page.request.post(`${API_URL}/reviews`, {
      data: { productId: 'test', rating: 5, comment: 'great' },
    })
    expect(res.status()).toBe(401)
  })
})

// ─── Phase 3: Wishlist ──────────────────────────────────────────────────────

test.describe('Wishlist endpoints', () => {
  test('GET /wishlist (customer) → 200', async ({ page }) => {
    const token = await customerLogin(page)
    const res = await page.request.get(`${API_URL}/wishlist`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status()).toBe(200)
  })

  test('GET /wishlist without auth → 401', async ({ page }) => {
    const res = await page.request.get(`${API_URL}/wishlist`)
    expect(res.status()).toBe(401)
  })
})

// ─── Phase 3: Addresses ─────────────────────────────────────────────────────

test.describe('Addresses endpoints', () => {
  test('GET /addresses (customer) → 200', async ({ page }) => {
    const token = await customerLogin(page)
    const res = await page.request.get(`${API_URL}/addresses`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status()).toBe(200)
  })

  test('GET /addresses without auth → 401', async ({ page }) => {
    const res = await page.request.get(`${API_URL}/addresses`)
    expect(res.status()).toBe(401)
  })
})

// ─── Phase 4: Admin Endpoints ───────────────────────────────────────────────

test.describe('Admin endpoints', () => {
  test('GET /admin/stats → 200 with revenue/orders/products/customers', async ({ page }) => {
    const token = await adminLogin(page)
    const res = await page.request.get(`${API_URL}/admin/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(typeof body.totalRevenue).toBe('number')
    expect(typeof body.ordersLast30Days).toBe('number')
    expect(typeof body.activeProducts).toBe('number')
    expect(typeof body.totalCustomers).toBe('number')
  })

  test('GET /admin/stats without auth → 401', async ({ page }) => {
    const res = await page.request.get(`${API_URL}/admin/stats`)
    expect(res.status()).toBe(401)
  })

  test('GET /admin/orders → 200 paginated', async ({ page }) => {
    const token = await adminLogin(page)
    const res = await page.request.get(`${API_URL}/admin/orders`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.orders)).toBeTruthy()
    expect(typeof body.total).toBe('number')
  })

  test('GET /admin/orders?status=PLACED filter works', async ({ page }) => {
    const token = await adminLogin(page)
    const res = await page.request.get(`${API_URL}/admin/orders?status=PLACED`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    for (const o of body.orders) {
      expect(o.status).toBe('PLACED')
    }
  })

  test('GET /admin/announcements → 200', async ({ page }) => {
    const token = await adminLogin(page)
    const res = await page.request.get(`${API_URL}/admin/announcements`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.announcements ?? body)).toBeTruthy()
  })

  test('GET /admin/coupons → 200', async ({ page }) => {
    const token = await adminLogin(page)
    const res = await page.request.get(`${API_URL}/admin/coupons`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.coupons ?? body)).toBeTruthy()
  })

  test('GET /admin/reviews → 200', async ({ page }) => {
    const token = await adminLogin(page)
    const res = await page.request.get(`${API_URL}/admin/reviews`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.reviews ?? body)).toBeTruthy()
  })

  test('GET /admin/custom-orders → 200', async ({ page }) => {
    const token = await adminLogin(page)
    const res = await page.request.get(`${API_URL}/admin/custom-orders`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.orders ?? body)).toBeTruthy()
  })

  test('Admin endpoints reject customer token → 403', async ({ page }) => {
    const token = await customerLogin(page)
    const res = await page.request.get(`${API_URL}/admin/orders`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status()).toBe(403)
  })

  test('Admin file upload endpoint requires auth → not 500', async ({ page }) => {
    const res = await page.request.post(`${API_URL}/admin/upload`)
    // Should reject without auth (401) not crash (500)
    expect(res.status()).toBeLessThan(500)
  })
})
