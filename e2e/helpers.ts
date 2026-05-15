/**
 * Shared helpers for E2E tests.
 * All API calls use `page.request` so they route through the browser
 * (respects ignoreHTTPSErrors and corporate proxy settings).
 */
import { Page, expect } from '@playwright/test'

const BASE_URL = 'https://delightful-mushroom-062e18100.7.azurestaticapps.net'
const API_URL  = 'https://func-thesrilathaarts-dev.azurewebsites.net/api'

/** Admin credentials */
export const ADMIN = { username: 'test@srilatha.art', password: 'test@123' }
/** Test customer credentials */
export const CUSTOMER = { email: 'testuser@srilatha.art', password: 'Test@1234' }

/** POST /auth/admin/login → returns Bearer token */
export async function adminLogin(page: Page): Promise<string> {
  const res = await page.request.post(`${API_URL}/auth/admin/login`, {
    data: { username: ADMIN.username, password: ADMIN.password },
  })
  expect(res.status(), 'admin login should succeed').toBe(200)
  const body = await res.json()
  expect(body.token, 'admin token must be present').toBeTruthy()
  return body.token as string
}

/** POST /auth/login → returns Bearer token */
export async function customerLogin(page: Page): Promise<string> {
  const res = await page.request.post(`${API_URL}/auth/login`, {
    data: { email: CUSTOMER.email, password: CUSTOMER.password },
  })
  expect(res.status(), 'customer login should succeed').toBe(200)
  const body = await res.json()
  expect(body.token, 'customer token must be present').toBeTruthy()
  return body.token as string
}

export { BASE_URL, API_URL }

