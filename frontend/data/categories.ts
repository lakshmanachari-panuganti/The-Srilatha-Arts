import type { Category } from '@/types'

export const CATEGORIES: Category[] = [
  {
    slug: 'resin',
    title: 'Resin Art',
    tagline: 'Liquid glass, captured forever',
    origin:
      'Translucent layers poured by hand - each piece a frozen river of color, light and ocean depth.',
    heroImage: '/images/logo.png',
    ordinal: 1,
  },
  {
    slug: 'dot-mandala',
    title: 'Dot Mandala',
    tagline: 'Meditation, one dot at a time',
    origin:
      'Concentric patterns built dot by dot, a meditative geometry inspired by sacred Indian rangoli.',
    heroImage: '/images/logo.png',
    ordinal: 2,
  },
  {
    slug: 'lippan',
    title: 'Lippan Art',
    tagline: 'Mud, mirror and memory from Kutch',
    origin:
      'A 400-year-old craft from the salt deserts of Kutch - clay reliefs studded with tiny mirrors that catch the lamp.',
    heroImage: '/images/logo.png',
    ordinal: 3,
  },
  {
    slug: 'pichwai',
    title: 'Pichwai Art',
    tagline: 'Devotional tapestries from Nathdwara',
    origin:
      'Hand-painted depictions of Lord Shrinathji - lotus, cow and peacock motifs in jewel tones.',
    heroImage: '/images/logo.png',
    ordinal: 4,
  },
  {
    slug: 'kolam',
    title: 'Kolam Art',
    tagline: 'Threshold prayers in white',
    origin:
      'South Indian rice-flour patterns reimagined as enduring wall art - a daily blessing made permanent.',
    heroImage: '/images/logo.png',
    ordinal: 5,
  },
]

export const CATEGORY_BY_SLUG = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c]),
) as Record<string, Category>
