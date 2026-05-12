import type { Announcement } from '@/types'

export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'flat30-resin',
    message: 'FLAT 30% OFF on Resin Art · Use code SRILATHA30',
    href: '/sale',
    priority: 1,
    theme: 'gold',
    active: true,
  },
  {
    id: 'free-ship',
    message: 'Free shipping on orders above ₹2,999 · Pan-India delivery',
    href: '/shop',
    priority: 2,
    theme: 'gold',
    active: true,
  },
  {
    id: 'diwali-live',
    message: 'Diwali Collection is live · Handcrafted in Hyderabad with love',
    href: '/collections/diwali',
    priority: 3,
    theme: 'gold',
    active: true,
  },
  {
    id: 'custom-slots',
    message: 'Custom commissions open · 2 slots left this month',
    href: '/custom-order',
    priority: 4,
    theme: 'gold',
    active: true,
  },
]
