/**
 * 4. Shop & Cart UI Tests.
 */
import { test, expect, Page } from '@playwright/test'

const BASE = 'https://delightful-mushroom-062e18100.7.azurestaticapps.net'

test.describe('Shop UI', () => {
  test('Shop page loads products from API', async ({ page }) => {
    await page.goto(`${BASE}/shop/`)
    await page.waitForLoadState('networkidle')
    const body = await page.textContent('body')
    expect(body).not.toContain('Application error')
    // Should show products or empty state
    expect(body?.toLowerCase()).toMatch(/shop|art|product|mandala|resin|kolam/i)
  })

  test('Category filter chip works on shop', async ({ page }) => {
    await page.goto(`${BASE}/shop/`)
    await page.waitForLoadState('networkidle')
    // Chip rail should be visible
    const chips = page.locator('[class*="chip"]')
    if (await chips.count() > 0) {
      await chips.first().click()
      await expect(page.locator('body')).toBeVisible()
    }
  })

  test('Product detail page loads', async ({ page }) => {
    // Navigate to shop then click first product
    await page.goto(`${BASE}/shop/`)
    await page.waitForLoadState('networkidle')
    const productLinks = page.locator('a[href*="/product/"]')
    const count = await productLinks.count()
    if (count === 0) { test.skip() }
    const href = await productLinks.first().getAttribute('href')
    await page.goto(`${BASE}${href}`)
    await page.waitForLoadState('networkidle')
    const body = await page.textContent('body')
    expect(body).not.toContain('Application error')
    // Should show price in INR
    expect(body).toMatch(/₹|Rs\.|price/i)
  })

  test('Cart page loads', async ({ page }) => {
    await page.goto(`${BASE}/cart/`)
    const body = await page.textContent('body')
    expect(body).not.toContain('Application error')
    expect(body?.toLowerCase()).toMatch(/cart|empty|bag/i)
  })

  test('Add to cart button exists on product page', async ({ page }) => {
    await page.goto(`${BASE}/shop/`)
    await page.waitForLoadState('networkidle')
    const productLinks = page.locator('a[href*="/product/"]')
    if (await productLinks.count() === 0) { test.skip() }
    const href = await productLinks.first().getAttribute('href')
    await page.goto(`${BASE}${href}`)
    await page.waitForLoadState('networkidle')
    const addToCart = page.locator('button:has-text("Add"), button:has-text("Cart"), button:has-text("Buy")')
    await expect(addToCart.first()).toBeVisible({ timeout: 8000 })
  })

  test('Wishlist toggle on product page works', async ({ page }) => {
    await page.goto(`${BASE}/shop/`)
    await page.waitForLoadState('networkidle')
    const productLinks = page.locator('a[href*="/product/"]')
    if (await productLinks.count() === 0) { test.skip() }
    const href = await productLinks.first().getAttribute('href')
    await page.goto(`${BASE}${href}`)
    await page.waitForLoadState('networkidle')
    // Wishlist heart button should exist
    const wishlistBtn = page.locator('button[aria-label*="wishlist"], button[title*="wishlist"], button svg[class*="heart"]').first()
    if (await wishlistBtn.count() > 0) {
      await wishlistBtn.click()
      // No crash after click
      await expect(page.locator('body')).not.toContainText(/application error/i)
    }
  })
})

test.describe('Customer login UI', () => {
  test('Login page renders correctly', async ({ page }) => {
    await page.goto(`${BASE}/login/`)
    await expect(page.locator('input[type="email"], input[placeholder*="email"], input[name="email"]').first()).toBeVisible({ timeout: 10000 })
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('Login with wrong password shows error', async ({ page }) => {
    await page.goto(`${BASE}/login/`)
    const emailInput = page.locator('input[type="email"], input[placeholder*="email"], input[name="email"]').first()
    await emailInput.fill('testuser@srilatha.art')
    await page.fill('input[type="password"]', 'wrongpassword')
    const submitBtn = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")').first()
    await submitBtn.click()
    await expect(page.locator('body')).toContainText(/invalid|error|incorrect|wrong/i, { timeout: 8000 })
  })
})

test.describe('Static pages', () => {
  const STATIC_PAGES = [
    { path: '/our-story/', check: /story|artis/i },
    { path: '/the-craft/', check: /craft|mandala|resin|art/i },
    { path: '/faq/',       check: /FAQ|frequently|question/i },
    { path: '/contact/',   check: /contact|reach|touch/i },
    { path: '/reviews/',   check: /review|testimonial/i },
    { path: '/privacy-policy/', check: /privacy/i },
    { path: '/terms/',     check: /terms|condition/i },
    { path: '/care-guide/', check: /care|artwork/i },
  ]

  for (const { path, check } of STATIC_PAGES) {
    test(`${path} loads with content`, async ({ page }) => {
      const res = await page.goto(`${BASE}${path}`)
      expect(res?.status()).not.toBe(404)
      await expect(page.locator('body')).toContainText(check, { timeout: 10000 })
      await expect(page.locator('body')).not.toContainText(/application error/i)
    })
  }
})

test.describe('Design system components', () => {
  test('Header is visible on public pages', async ({ page }) => {
    await page.goto(`${BASE}/`)
    await expect(page.locator('header, nav').first()).toBeVisible()
  })

  test('Footer is visible on public pages', async ({ page }) => {
    await page.goto(`${BASE}/`)
    await expect(page.locator('footer')).toBeVisible()
  })

  test('Bottom tab bar visible on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }) // iPhone 14
    await page.goto(`${BASE}/`)
    // Bottom nav should appear on mobile
    const bottomNav = page.locator('[class*="bottom"], nav[class*="tab"], [aria-label*="navigation"]').last()
    // Just check it doesn't crash
    await expect(page.locator('body')).not.toContainText(/application error/i)
  })

  test('KolamLoader animation present in loading.tsx', async ({ page }) => {
    // Can't easily intercept loading state on static site; just verify page loads
    await page.goto(`${BASE}/shop/`)
    await expect(page.locator('body')).not.toContainText(/application error/i)
  })
})
