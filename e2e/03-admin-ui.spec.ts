/**
 * 3. Admin UI Tests - login + all wired admin pages render without errors.
 */
import { test, expect, Page } from '@playwright/test'

const BASE = 'https://delightful-mushroom-062e18100.7.azurestaticapps.net'
const ADMIN = { username: 'test@srilatha.art', password: 'test@123' }

async function adminLogIn(page: Page) {
  await page.goto(`${BASE}/admin/login/`)
  await page.waitForSelector('input[placeholder="admin"]', { timeout: 15000 })
  await page.fill('input[placeholder="admin"]', ADMIN.username)
  await page.fill('input[placeholder="••••••••"]', ADMIN.password)
  await page.click('button:has-text("Access Workspace")')
  // Wait for redirect to dashboard
  await page.waitForURL(/\/admin\/?$/, { timeout: 15000 })
}

test.describe('Admin auth UI', () => {
  test('Admin login page loads', async ({ page }) => {
    await page.goto(`${BASE}/admin/login/`)
    await expect(page.locator('input[placeholder="admin"]')).toBeVisible()
    await expect(page.locator('input[placeholder="••••••••"]')).toBeVisible()
    await expect(page.locator('button:has-text("Access Workspace")')).toBeVisible()
  })

  test('Admin login with wrong password shows error', async ({ page }) => {
    await page.goto(`${BASE}/admin/login/`)
    await page.fill('input[placeholder="admin"]', ADMIN.username)
    await page.fill('input[placeholder="••••••••"]', 'wrongpassword')
    await page.click('button:has-text("Access Workspace")')
    // Should show error, not redirect
    await expect(page.locator('body')).toContainText(/invalid|error|incorrect/i, { timeout: 8000 })
  })

  test('Admin login succeeds → redirects to /admin', async ({ page }) => {
    await adminLogIn(page)
    await expect(page).toHaveURL(/\/admin\/?$/)
  })
})

test.describe('Admin pages (logged in)', () => {
  test.beforeEach(async ({ page }) => {
    await adminLogIn(page)
  })

  const ADMIN_PAGES = [
    { path: '/admin/',               label: 'Dashboard',      check: /dashboard|revenue|orders/i },
    { path: '/admin/orders/',        label: 'Orders',         check: /orders/i },
    { path: '/admin/products/',      label: 'Products',       check: /products/i },
    { path: '/admin/reviews/',       label: 'Reviews',        check: /reviews|moderation/i },
    { path: '/admin/coupons/',       label: 'Coupons',        check: /coupons|discount/i },
    { path: '/admin/announcements/', label: 'Announcements',  check: /announcement|banner/i },
    { path: '/admin/custom-orders/', label: 'Custom Orders',  check: /custom/i },
    { path: '/admin/inventory/',     label: 'Inventory',      check: /inventory|stock/i },
  ]

  for (const { path, label, check } of ADMIN_PAGES) {
    test(`${label} page loads without errors`, async ({ page }) => {
      await page.goto(`${BASE}${path}`)
      // No crash
      await expect(page.locator('body')).not.toContainText(/application error|500|unexpected error/i)
      // Contains expected content
      await expect(page.locator('body')).toContainText(check, { timeout: 12000 })
    })
  }

  test('Admin dashboard shows stat cards', async ({ page }) => {
    await page.goto(`${BASE}/admin/`)
    // Should have numeric KPI cards (Revenue, Orders, etc.)
    const cards = page.locator('[class*="card"], [class*="kpi"], [class*="stat"]')
    await expect(cards.first()).toBeVisible({ timeout: 10000 })
  })

  test('Admin orders list loads and shows table/list', async ({ page }) => {
    await page.goto(`${BASE}/admin/orders/`)
    await page.waitForLoadState('networkidle')
    const body = await page.textContent('body')
    // Either shows orders or empty state - no error
    expect(body).not.toContain('Application error')
    expect(body?.toLowerCase()).toMatch(/order|empty|no orders/i)
  })

  test('Admin products list loads from API', async ({ page }) => {
    await page.goto(`${BASE}/admin/products/`)
    await page.waitForLoadState('networkidle')
    const body = await page.textContent('body')
    expect(body).not.toContain('Application error')
  })

  test('Admin reviews page shows moderation queue', async ({ page }) => {
    await page.goto(`${BASE}/admin/reviews/`)
    await page.waitForLoadState('networkidle')
    const body = await page.textContent('body')
    expect(body).not.toContain('Application error')
    expect(body?.toLowerCase()).toMatch(/review|pending|no review|empty/i)
  })

  test('Admin coupons page shows coupon list', async ({ page }) => {
    await page.goto(`${BASE}/admin/coupons/`)
    await page.waitForLoadState('networkidle')
    const body = await page.textContent('body')
    expect(body).not.toContain('Application error')
    expect(body?.toLowerCase()).toMatch(/coupon|discount|no coupon|empty/i)
  })

  test('Admin announcements page loads', async ({ page }) => {
    await page.goto(`${BASE}/admin/announcements/`)
    await page.waitForLoadState('networkidle')
    const body = await page.textContent('body')
    expect(body).not.toContain('Application error')
    expect(body?.toLowerCase()).toMatch(/announcement|banner|no announcement|empty/i)
  })

  test('Admin products/new page has form fields', async ({ page }) => {
    await page.goto(`${BASE}/admin/products/new/`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('input, textarea, select').first()).toBeVisible({ timeout: 10000 })
  })

  test('Unauthenticated /admin redirects to /admin/login', async ({ page: freshPage }) => {
    // Use a fresh page with no admin token
    await freshPage.goto(`${BASE}/admin/`)
    await expect(freshPage).toHaveURL(/admin\/login/, { timeout: 10000 })
  })
})
