import { defineConfig, devices } from '@playwright/test'

const BASE_URL = 'https://delightful-mushroom-062e18100.7.azurestaticapps.net'
const API_URL  = 'https://func-thesrilathaarts-dev.azurewebsites.net/api'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,        // keep sequential — shared live data
  retries: 1,
  timeout: 30_000,
  use: {
    baseURL: BASE_URL,
    extraHTTPHeaders: { 'x-tsa-qa': '1' },
    ignoreHTTPSErrors: true,    // corporate proxy uses self-signed cert
    screenshot: 'only-on-failure',
    video: 'off',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
})

export { BASE_URL, API_URL }
