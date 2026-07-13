// Inject explicit SWA routes for pre-rendered product pages.
//
// WHY: staticwebapp.config.json rewrites `/product/*` to the client-rendered
// shell so products created after a deploy keep working. But SWA route
// rewrites are UNCONDITIONAL - they apply even when a physical file exists
// at the requested path - so the wildcard alone would also swallow the
// pre-rendered /product/<id>/index.html pages (built by generateStaticParams
// for SEO / social previews) and serve the shell to every crawler.
//
// FIX: SWA evaluates the `routes` array top-down, first match wins. This
// script runs in CI after `next build` and prepends one exact route per
// exported product page ABOVE the wildcard. Known products therefore serve
// their real static HTML; anything else still falls through to `/product/*`
// → shell, exactly as before.
//
// Run from the frontend/ directory: `node scripts/inject-product-routes.mjs`.
// CI-only by design - it mutates staticwebapp.config.json in the checked-out
// working copy that the SWA deploy action reads (config_file_location);
// the committed file is never dirtied locally. Idempotent: previously
// injected exact /product/ routes are stripped before re-injecting.
//
// SWA's config file has a documented size cap (~20KB). We fail LOUDLY at
// 19KB rather than deploy a config SWA might reject or truncate. If the
// catalog ever grows past that, move product HTML behind a different
// fallback strategy.

import fs from 'node:fs'
import path from 'node:path'

const frontendDir = process.cwd()
const outProductDir = path.join(frontendDir, 'out', 'product')
const configPath = path.join(frontendDir, 'staticwebapp.config.json')
const MAX_CONFIG_BYTES = 19 * 1024

const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'))
if (!Array.isArray(cfg.routes)) {
  console.error('inject-product-routes: staticwebapp.config.json has no routes array - aborting')
  process.exit(1)
}

let ids = []
if (fs.existsSync(outProductDir)) {
  ids = fs
    .readdirSync(outProductDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== '__shell__')
    // Belt-and-braces: only slug-shaped ids, and only dirs that actually
    // contain an exported page.
    .filter((d) => /^[A-Za-z0-9._-]+$/.test(d.name))
    .filter((d) => fs.existsSync(path.join(outProductDir, d.name, 'index.html')))
    .map((d) => d.name)
    .sort()
}

// Strip any previously injected exact /product/<id> routes (idempotency).
// The wildcard rule contains '*' and is never matched by this test.
const isInjectedProductRoute = (r) =>
  r && typeof r.route === 'string' && /^\/product\/[^*]+$/.test(r.route)
const baseRoutes = cfg.routes.filter((r) => !isInjectedProductRoute(r))

const injected = ids.map((id) => ({
  route: `/product/${id}`,
  rewrite: `/product/${id}/index.html`,
}))

cfg.routes = [...injected, ...baseRoutes]

const json = JSON.stringify(cfg, null, 2) + '\n'
const bytes = Buffer.byteLength(json)
if (bytes > MAX_CONFIG_BYTES) {
  console.error(
    `inject-product-routes: config would be ${bytes} bytes (> ${MAX_CONFIG_BYTES}). ` +
      'SWA caps the config size - reduce injected routes (see header comment) before deploying.',
  )
  process.exit(1)
}

fs.writeFileSync(configPath, json)
console.log(
  `inject-product-routes: ${ids.length} pre-rendered product page(s) → ${injected.length} route(s) injected; config is ${bytes} bytes`,
)
