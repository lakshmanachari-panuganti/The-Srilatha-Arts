import { test, expect, Page, ConsoleMessage } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const VIEWPORTS = [
  { name: 'desktop', width: 1920, height: 1080 },
  { name: 'tablet',  width: 768,  height: 1024 },
  { name: 'mobile',  width: 390,  height: 844  },
] as const

const PAGES = [
  { name: 'home',           url: '/'                                          },
  { name: 'gallery',        url: '/shop/'                                     },
  { name: 'collections',    url: '/collections/'                              },
  { name: 'product-detail', url: '/product/__shell__/' },
  { name: 'custom-orders',  url: '/custom-order/'                             },
  { name: 'cart',           url: '/cart/'                                     },
  { name: 'checkout',       url: '/checkout/'                                 },
  { name: 'contact',        url: '/contact/'                                  },
  { name: 'about',          url: '/our-story/'                                },
] as const

const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots')
const ISSUES_FILE    = path.resolve(__dirname, 'issues.json')

type Issue = {
  viewport: string
  page: string
  category: string
  detail: string
}
const ISSUES: Issue[] = []

function flag(viewport: string, pageName: string, category: string, detail: string) {
  ISSUES.push({ viewport, page: pageName, category, detail })
}

async function captureChecks(page: Page, viewport: string, pageName: string, vw: number) {
  // 1) horizontal scroll detection
  const hScroll = await page.evaluate(() => ({
    docW: document.documentElement.scrollWidth,
    winW: window.innerWidth,
    bodyOverflowX: getComputedStyle(document.body).overflowX,
  }))
  if (hScroll.docW > hScroll.winW + 1) {
    flag(viewport, pageName, 'horizontal-scroll',
      `documentElement.scrollWidth=${hScroll.docW} > innerWidth=${hScroll.winW} (delta ${hScroll.docW - hScroll.winW}px)`)
  }

  // 2) text overflow per visible element (sample text nodes)
  const overflowing = await page.evaluate(() => {
    const out: Array<{ tag: string; cls: string; w: number; sw: number; text: string }> = []
    const els = Array.from(document.querySelectorAll('h1, h2, h3, p, a, button, span'))
    for (const el of els) {
      const e = el as HTMLElement
      if (!e.offsetParent) continue
      const cs = getComputedStyle(e)
      if (cs.overflow === 'hidden' || cs.overflowX === 'hidden') continue
      if (e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 50) {
        out.push({
          tag: e.tagName,
          cls: e.className?.toString().slice(0, 80) ?? '',
          w: e.clientWidth,
          sw: e.scrollWidth,
          text: (e.textContent ?? '').trim().slice(0, 60),
        })
      }
      if (out.length >= 12) break
    }
    return out
  })
  for (const o of overflowing) {
    flag(viewport, pageName, 'text-overflow',
      `<${o.tag}> sw=${o.sw}>cw=${o.w} "${o.text}"`)
  }

  // 3) images failed to load
  const brokenImgs = await page.evaluate(() => {
    const out: Array<{ src: string; w: number; h: number }> = []
    for (const img of Array.from(document.images)) {
      if (!img.complete || img.naturalWidth === 0) {
        if (img.offsetParent) out.push({ src: img.currentSrc || img.src, w: img.width, h: img.height })
      }
    }
    return out
  })
  for (const b of brokenImgs) {
    flag(viewport, pageName, 'broken-image', `src=${b.src} w=${b.w} h=${b.h}`)
  }

  // 4) Cumulative Layout Shift (PerformanceObserver)
  const cls = await page.evaluate(() => (window as any).__CLS_VALUE__ ?? 0)
  if (typeof cls === 'number' && cls > 0.1) {
    flag(viewport, pageName, 'layout-shift', `CLS=${cls.toFixed(3)}`)
  }

  // 5) overlapping interactive elements (basic): nav cluster overlapping each other
  const overlaps = await page.evaluate(() => {
    const out: string[] = []
    const sel = 'header a, header button, [role="navigation"] a, [role="navigation"] button'
    const list = Array.from(document.querySelectorAll(sel)) as HTMLElement[]
    for (let i = 0; i < list.length; i++) {
      const r1 = list[i].getBoundingClientRect()
      if (r1.width === 0 || r1.height === 0) continue
      for (let j = i + 1; j < list.length; j++) {
        const r2 = list[j].getBoundingClientRect()
        if (r2.width === 0 || r2.height === 0) continue
        const overlapX = Math.max(0, Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left))
        const overlapY = Math.max(0, Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top))
        if (overlapX > 4 && overlapY > 4) {
          out.push(`<${list[i].tagName}> "${(list[i].textContent||'').trim().slice(0,20)}" ∩ <${list[j].tagName}> "${(list[j].textContent||'').trim().slice(0,20)}"`)
          if (out.length >= 5) return out
        }
      }
    }
    return out
  })
  for (const o of overlaps) {
    flag(viewport, pageName, 'overlap-nav', o)
  }

  // 6) screenshot
  const ssPath = path.join(SCREENSHOT_DIR, `${viewport}-${pageName}.png`)
  await page.screenshot({ path: ssPath, fullPage: true })
}

for (const vp of VIEWPORTS) {
  test.describe(`viewport=${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } })

    for (const p of PAGES) {
      test(`${p.name}`, async ({ page }) => {
        const consoleErrors: string[] = []
        page.on('console', (m: ConsoleMessage) => {
          if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 240))
        })
        page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message.slice(0, 240)}`))

        // Install CLS observer before nav
        await page.addInitScript(() => {
          ;(window as any).__CLS_VALUE__ = 0
          try {
            const po = new (window as any).PerformanceObserver((entryList: any) => {
              for (const entry of entryList.getEntries()) {
                if (!entry.hadRecentInput) {
                  ;(window as any).__CLS_VALUE__ += entry.value
                }
              }
            })
            po.observe({ type: 'layout-shift', buffered: true })
          } catch {}
        })

        const res = await page.goto(p.url, { waitUntil: 'networkidle', timeout: 45_000 })
        if (!res || !res.ok()) {
          flag(vp.name, p.name, 'http-status', `status=${res?.status() ?? 'no-response'}`)
        }
        // Allow late paints + IntersectionObserver reveals
        await page.waitForTimeout(700)

        await captureChecks(page, vp.name, p.name, vp.width)

        if (consoleErrors.length) {
          for (const e of consoleErrors.slice(0, 5)) {
            flag(vp.name, p.name, 'console-error', e)
          }
        }
      })
    }
  })
}

test('zz-write-issues-file', async () => {
  // The afterAll equivalent in this file-scope: re-write each call.
  fs.writeFileSync(ISSUES_FILE, JSON.stringify(ISSUES, null, 2), 'utf8')
  expect(true).toBeTruthy()
})

test.afterAll(async () => {
  fs.writeFileSync(ISSUES_FILE, JSON.stringify(ISSUES, null, 2), 'utf8')
})
