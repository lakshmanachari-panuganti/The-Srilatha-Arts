#!/usr/bin/env node
/**
 * Build-time image optimisation.
 *
 * Runs as `prebuild` so the export in `out/` always has the latest variants.
 * Idempotent — skips outputs that exist and are newer than the source.
 *
 * Produces:
 *   1. Logo derivatives from public/Logos/logo.png
 *        - favicon-32.png, favicon-180.png (apple-touch-icon)
 *        - pwa-192.png, pwa-512.png, pwa-512-maskable.png
 *        - og-cover.jpg (1200x630, logo centred on brand background)
 *
 *   2. WebP companions for every .jpg under public/category/ and
 *      public/Slideshow/ (kept alongside the .jpg so a <picture> element
 *      can pick the smaller variant when supported).
 *
 * No AVIF — generation is 5–10x slower than WebP for ~10% extra size win,
 * and on a single-studio shop the build-time cost outweighs the byte
 * savings. Revisit if image bytes become a bottleneck.
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PUBLIC = path.resolve(__dirname, '..', 'public')

// Brand cream-deep background — matches --paper in globals.css.
const BRAND_BG = { r: 251, g: 248, b: 242, alpha: 1 }

async function exists(p) {
  try { await fs.access(p); return true } catch { return false }
}

async function isStaleVs(src, out) {
  if (!(await exists(out))) return true
  const [srcStat, outStat] = await Promise.all([fs.stat(src), fs.stat(out)])
  return srcStat.mtimeMs > outStat.mtimeMs
}

async function buildLogoDerivatives() {
  const src = path.join(PUBLIC, 'Logos', 'logo.png')
  if (!(await exists(src))) {
    console.warn(`[images] skip logo derivatives - source missing: ${src}`)
    return
  }

  const targets = [
    { out: 'Logos/favicon-32.png',         w: 32,  h: 32,  fit: 'contain' },
    { out: 'Logos/favicon-180.png',        w: 180, h: 180, fit: 'contain' },
    { out: 'Logos/pwa-192.png',            w: 192, h: 192, fit: 'contain' },
    { out: 'Logos/pwa-512.png',            w: 512, h: 512, fit: 'contain' },
    // Maskable icon needs a safe zone — pad logo to ~80% of the canvas so it
    // survives the OS clipping mask. fit:contain + larger background gets us
    // close enough without a separate template file.
    { out: 'Logos/pwa-512-maskable.png',   w: 512, h: 512, fit: 'contain', pad: 0.1 },
  ]

  for (const t of targets) {
    const outPath = path.join(PUBLIC, t.out)
    if (!(await isStaleVs(src, outPath))) continue
    const padPx = t.pad ? Math.round(Math.min(t.w, t.h) * t.pad) : 0
    await sharp(src)
      .resize(t.w - padPx * 2, t.h - padPx * 2, {
        fit: t.fit,
        background: BRAND_BG,
      })
      .extend({
        top: padPx, bottom: padPx, left: padPx, right: padPx,
        background: BRAND_BG,
      })
      .flatten({ background: BRAND_BG })
      .png({ compressionLevel: 9, palette: true })
      .toFile(outPath)
    console.log(`[images] wrote ${t.out}`)
  }

  // OG cover — 1200x630, logo centred at ~40% of the height on the brand
  // background. Used by all social previews + WhatsApp link cards.
  const ogOut = path.join(PUBLIC, 'Logos', 'og-cover.jpg')
  if (await isStaleVs(src, ogOut)) {
    const logoH = Math.round(630 * 0.4)
    const logoBuf = await sharp(src)
      .resize({ height: logoH, fit: 'inside', withoutEnlargement: true })
      .toBuffer()
    await sharp({
      create: { width: 1200, height: 630, channels: 3, background: BRAND_BG },
    })
      .composite([{ input: logoBuf, gravity: 'center' }])
      .jpeg({ quality: 85, mozjpeg: true })
      .toFile(ogOut)
    console.log('[images] wrote Logos/og-cover.jpg')
  }
}

async function* walkJpegs(dir) {
  let entries
  try { entries = await fs.readdir(dir, { withFileTypes: true }) }
  catch { return }
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) yield* walkJpegs(full)
    else if (/\.(jpe?g)$/i.test(e.name)) yield full
  }
}

async function buildWebpCompanions() {
  const roots = [
    path.join(PUBLIC, 'category'),
    path.join(PUBLIC, 'Slideshow'),
  ]
  let count = 0
  for (const root of roots) {
    for await (const jpg of walkJpegs(root)) {
      const webp = jpg.replace(/\.(jpe?g)$/i, '.webp')
      if (!(await isStaleVs(jpg, webp))) continue
      await sharp(jpg)
        .webp({ quality: 78, effort: 4 })
        .toFile(webp)
      count++
    }
  }
  if (count > 0) console.log(`[images] wrote ${count} .webp companion(s)`)
}

async function main() {
  await buildLogoDerivatives()
  await buildWebpCompanions()
}

main().catch((err) => {
  console.error('[images] failed:', err)
  process.exit(1)
})
