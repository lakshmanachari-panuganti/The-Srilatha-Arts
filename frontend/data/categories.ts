import type { Category } from '@/types'

/**
 * Site-wide category catalogue.
 *
 * Pichwai was removed in 2026-05 — no actual artwork existed for it in
 * /public/category/, so showing it as a category was a trust hit (audit
 * §1.5). Wedding Decoratives added in its place to match the homepage
 * slideshow and the real inventory in /public/category/wedding/.
 *
 * `heroImage` now points at a real piece per category (was a brand-logo
 * placeholder for all 5, which made every card on the home page look
 * identical — audit §1.2). To swap the hero image, just change the path
 * here; ShopByArtForm + any category landing reads from this.
 */
export const CATEGORIES: Category[] = [
  {
    slug: 'resin',
    title: 'Resin Art',
    tagline: 'Bright, glossy art with poured colour',
    origin:
      'We pour clear resin in layers to lock in bright colours, sparkle and texture. The finish is smooth and glassy — easy to clean and very long lasting.',
    heroImage: '/category/resin/1d122ae3b1de18057f325bb4eb346151.jpg',
    ordinal: 1,
  },
  {
    slug: 'dot-mandala',
    title: 'Dot Mandala',
    tagline: 'Hand-painted dot patterns',
    origin:
      'Mandalas drawn one dot at a time. Inspired by traditional Indian rangoli — calming to look at and a slow, careful craft to make.',
    heroImage: '/category/dot-mandala/29edd2b99f56d8048df6aea5ef22895b.jpg',
    ordinal: 2,
  },
  {
    slug: 'lippan',
    title: 'Lippan Art',
    tagline: 'Clay art with tiny mirrors',
    origin:
      'A 400-year-old folk craft from the Kutch region. Hand-shaped clay patterns set with small mirrors that catch the light beautifully.',
    heroImage: '/category/lippan/1edb12e7ed96b46b7a4e9f79c1a85167.jpg',
    ordinal: 3,
  },
  {
    slug: 'kolam',
    title: 'Kolam Art',
    tagline: 'South Indian rangoli, made for the wall',
    origin:
      'Traditional South Indian rangoli patterns — usually drawn each morning with rice flour — made into permanent wall art you can keep up all year.',
    heroImage: '/category/kolam/4a9b492ed49541bed2ab9620566352b1.jpg',
    ordinal: 4,
  },
  {
    slug: 'wedding',
    title: 'Wedding Decoratives',
    tagline: 'Custom keepsakes for the day you remember forever',
    origin:
      'Coconut decor, preserved garlands and personalised wedding gifts — each piece made on order for one couple only. The work that means the most.',
    heroImage: '/category/wedding/8e19fc3c91b74b3260878d9b672b44f5.jpg',
    ordinal: 5,
  },
]

export const CATEGORY_BY_SLUG = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c]),
) as Record<string, Category>
