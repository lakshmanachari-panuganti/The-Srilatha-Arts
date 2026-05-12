export type CategorySlug =
  | 'resin'
  | 'dot-mandala'
  | 'lippan'
  | 'pichwai'
  | 'kolam'

export interface Category {
  slug: CategorySlug
  title: string
  tagline: string
  origin: string
  heroImage: string
  ordinal: number
}

export interface Product {
  id: string
  slug: string
  title: string
  category: CategorySlug
  price: number          // in rupees
  compareAtPrice?: number
  size: string
  material: string
  timeToMake: string     // e.g. "5 days"
  description: string
  shortDescription: string
  careInstructions: string
  images: string[]       // first is primary
  inStock: boolean
  stockQty: number
  featured: boolean
  isNewArrival: boolean
  isBestSeller: boolean
  isOnSale: boolean
  rating?: number
  reviewCount?: number
  createdAt: string
}

export interface Announcement {
  id: string
  message: string
  href: string
  startDate?: string
  endDate?: string
  priority: number
  theme: 'gold' | 'festive-pink' | 'muted'
  active: boolean
}

export interface CartItem {
  productId: string
  slug: string
  title: string
  category: CategorySlug
  price: number
  image: string
  quantity: number
  size: string
}

export interface WishlistItem {
  productId: string
  slug: string
  title: string
  image: string
  price: number
  category: CategorySlug
  addedAt: string
}

export interface User {
  email: string
  name: string
  phone?: string
  picture?: string
  role: 'customer' | 'admin' | 'superadmin'
}
