import type { Category } from '@/types'

export const CATEGORIES: Category[] = [
  {
    slug: 'resin',
    title: 'Resin Art',
    tagline: 'Bright, glossy art with poured colour',
    origin:
      'We pour clear resin in layers to lock in bright colours, sparkle and texture. The finish is smooth and glassy — easy to clean and very long lasting.',
    heroImage: '/Logos/logo.jpeg',
    ordinal: 1,
  },
  {
    slug: 'dot-mandala',
    title: 'Dot Mandala',
    tagline: 'Hand-painted dot patterns',
    origin:
      'Mandalas drawn one dot at a time. Inspired by traditional Indian rangoli — calming to look at and a slow, careful craft to make.',
    heroImage: '/Logos/logo.jpeg',
    ordinal: 2,
  },
  {
    slug: 'lippan',
    title: 'Lippan Art',
    tagline: 'Clay art with tiny mirrors',
    origin:
      'A 400-year-old folk craft from the Kutch region. Hand-shaped clay patterns set with small mirrors that catch the light beautifully.',
    heroImage: '/Logos/logo.jpeg',
    ordinal: 3,
  },
  {
    slug: 'pichwai',
    title: 'Pichwai Art',
    tagline: 'Traditional Indian devotional paintings',
    origin:
      'Devotional art from Nathdwara, Rajasthan. Hand-painted scenes of Lord Shrinathji with cows, lotuses and peacocks in rich, jewel-like colours.',
    heroImage: '/Logos/logo.jpeg',
    ordinal: 4,
  },
  {
    slug: 'kolam',
    title: 'Kolam Art',
    tagline: 'South Indian rangoli, made for the wall',
    origin:
      'Traditional South Indian rangoli patterns — usually drawn each morning with rice flour — made into permanent wall art you can keep up all year.',
    heroImage: '/Logos/logo.jpeg',
    ordinal: 5,
  },
]

export const CATEGORY_BY_SLUG = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c]),
) as Record<string, Category>
