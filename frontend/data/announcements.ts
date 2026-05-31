import type { Announcement } from '@/types'

/**
 * Marquee announcements.
 *
 * The previous "FLAT 30% OFF · USE CODE SRILATHA30" was removed deliberately
 * — discount-code shouting at the top of the page reads as "Amazon seller",
 * not "luxury handcrafted studio". Keep this surface for brand-positive,
 * service-promise content: shipping, hours, special collections.
 *
 * If a real promo runs, prefer email + the newsletter — not the chrome.
 */
export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'free-ship',
    message: 'Free shipping on orders above ₹999 · Pan-India delivery',
    href: '/shop',
    priority: 1,
    theme: 'gold',
    active: true,
  },
  {
    id: 'custom-slots',
    message: 'Custom Creations open · A few slots left this month',
    href: '/custom-order',
    priority: 2,
    theme: 'gold',
    active: true,
  },
  {
    id: 'made-by-hand',
    message: 'Each piece is hand-painted in our Hyderabad studio',
    href: '/our-story',
    priority: 3,
    theme: 'gold',
    active: true,
  },
]
