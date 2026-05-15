/**
 * 1. Public Pages — visual smoke tests.
 * Verifies every ✅ public page loads without error.
 */
import { test, expect } from '@playwright/test'

const BASE = 'https://delightful-mushroom-062e18100.7.azurestaticapps.net'

const PUBLIC_PAGES: { path: string; titleContains: string; contentCheck?: string }[] = [
  { path: '/',                    titleContains: 'Srilatha',   contentCheck: 'collection' },
  { path: '/shop',                titleContains: 'Srilatha',   contentCheck: 'Shop' },
  { path: '/cart',                titleContains: 'Srilatha',   contentCheck: 'cart' },
  { path: '/checkout',            titleContains: 'Srilatha',   contentCheck: 'checkout' },
  { path: '/custom-order',        titleContains: 'Srilatha',   contentCheck: 'custom' },
  { path: '/login',               titleContains: 'Srilatha',   contentCheck: 'Login' },
  { path: '/our-story',           titleContains: 'Srilatha',   contentCheck: 'story' },
  { path: '/the-craft',           titleContains: 'Srilatha',   contentCheck: 'craft' },
  { path: '/reviews',             titleContains: 'Srilatha',   contentCheck: 'review' },
  { path: '/contact',             titleContains: 'Srilatha',   contentCheck: 'contact' },
  { path: '/faq',                 titleContains: 'Srilatha',   contentCheck: 'FAQ' },
  { path: '/shipping-and-returns', titleContains: 'Srilatha',  contentCheck: 'shipping' },
  { path: '/care-guide',          titleContains: 'Srilatha',   contentCheck: 'care' },
  { path: '/privacy-policy',      titleContains: 'Srilatha',   contentCheck: 'privacy' },
  { path: '/terms',               titleContains: 'Srilatha',   contentCheck: 'terms' },
  { path: '/new-arrivals',        titleContains: 'Srilatha',   contentCheck: 'arrival' },
  { path: '/best-sellers',        titleContains: 'Srilatha',   contentCheck: 'seller' },
  { path: '/sale',                titleContains: 'Srilatha',   contentCheck: 'sale' },
  { path: '/collections',         titleContains: 'Srilatha',   contentCheck: 'collection' },
]

for (const { path, titleContains, contentCheck } of PUBLIC_PAGES) {
  test(`Public page: ${path}`, async ({ page }) => {
    const res = await page.goto(`${BASE}${path}`)
    expect(res?.status(), `${path} should not 404`).not.toBe(404)
    expect(res?.status(), `${path} should not 500`).not.toBe(500)
    // Should contain site title
    await expect(page).toHaveTitle(new RegExp(titleContains, 'i'))
    // Page should not show a raw error
    const body = await page.textContent('body')
    expect(body).not.toContain('Application error')
    expect(body).not.toContain('Internal Server Error')
    if (contentCheck) {
      await expect(page.locator('body')).toContainText(new RegExp(contentCheck, 'i'))
    }
  })
}

test('404 page shows blank-canvas message', async ({ page }) => {
  const res = await page.goto(`${BASE}/this-page-does-not-exist`)
  await expect(page.locator('body')).toContainText(/blank|not found/i)
})
