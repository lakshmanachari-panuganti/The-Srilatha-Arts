import type { Category } from '@/types'

export const CATEGORIES: Category[] = [
  {
    slug: 'resin',
    title: 'Resin Art',
    tagline: 'Bright, glossy art with poured colour',
    origin:
      'We pour clear resin in layers to lock in bright colours, sparkle and texture. The finish is smooth and glassy — easy to clean and very long lasting.',
    heroImage: '/images/slideshow/01-resin.jpg',
    ordinal: 1,
  },
  {
    slug: 'dot-mandala',
    title: 'Dot Mandala',
    tagline: 'Hand-painted dot patterns',
    origin:
      'Mandalas drawn one dot at a time. Inspired by traditional Indian rangoli — calming to look at and a slow, careful craft to make.',
    heroImage: '/images/slideshow/02-dot-mandala.jpg',
    ordinal: 2,
  },
  {
    slug: 'lippan',
    title: 'Lippan Art',
    tagline: 'Clay art with tiny mirrors',
    origin:
      'A 400-year-old folk craft from the Kutch region. Hand-shaped clay patterns set with small mirrors that catch the light beautifully.',
    heroImage: '/images/slideshow/03-lippan.jpg',
    ordinal: 3,
  },
  {
    slug: 'pichwai',
    title: 'Wedding & Festive Decor',
    tagline: 'Stunning handcrafted items for your special occasions',
    origin:
      'Beautifully crafted traditional plates, floral accents and wedding decoratives made by hand to bring color and auspiciousness to your celebrations.',
    heroImage: '/images/slideshow/05-wedding-decoratives.jpg',
    ordinal: 4,
  },
  {
    slug: 'kolam',
    title: 'Kolam Art',
    tagline: 'South Indian rangoli, made for the wall',
    origin:
      'Traditional South Indian rangoli patterns — usually drawn each morning with rice flour — made into permanent wall art you can keep up all year.',
    heroImage: '/images/slideshow/04-kolam.jpg',
    ordinal: 5,
  },
]

export const CATEGORY_BY_SLUG = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c]),
) as Record<string, Category>
