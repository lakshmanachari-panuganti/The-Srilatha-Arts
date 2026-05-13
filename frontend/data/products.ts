import { apiFetch } from '@/lib/api'
import type { Product } from '@/types'

// Revalidate frequently or bypass cache to allow real-time updates
const CACHE_OPTS = { next: { revalidate: 60 } } as const

export async function getAllProducts(): Promise<Product[]> {
  try {
    const res = await apiFetch<{ products: Product[] }>('/products', CACHE_OPTS)
    return res.products || []
  } catch (e) {
    console.error('Failed to fetch all products:', e)
    return []
  }
}

export async function getProductById(id: string): Promise<Product | undefined> {
  try {
    const res = await apiFetch<{ product: Product }>(`/products/${id}`, CACHE_OPTS)
    return res.product
  } catch (e) {
    console.error(`Failed to fetch product ${id}:`, e)
    return undefined
  }
}

export async function getProductsByCategory(category: string): Promise<Product[]> {
  try {
    const res = await apiFetch<{ products: Product[] }>(`/products?category=${category}`, CACHE_OPTS)
    return res.products || []
  } catch (e) {
    console.error(`Failed to fetch products for category ${category}:`, e)
    return []
  }
}

export async function getFeaturedProducts(): Promise<Product[]> {
  try {
    const res = await apiFetch<{ products: Product[] }>('/products?featured=true', CACHE_OPTS)
    return res.products || []
  } catch (e) {
    console.error('Failed to fetch featured products:', e)
    return []
  }
}

export async function getNewArrivals(): Promise<Product[]> {
  try {
    const res = await apiFetch<{ products: Product[] }>('/products?newArrivals=true', CACHE_OPTS)
    return res.products || []
  } catch (e) {
    console.error('Failed to fetch new arrivals:', e)
    return []
  }
}

export async function getBestSellers(): Promise<Product[]> {
  try {
    const res = await apiFetch<{ products: Product[] }>('/products?bestSellers=true', CACHE_OPTS)
    return res.products || []
  } catch (e) {
    console.error('Failed to fetch best sellers:', e)
    return []
  }
}

export const PRODUCTS: Product[] = []
