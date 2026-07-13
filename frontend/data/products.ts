import { apiFetch } from '@/lib/api'
import type { Product } from '@/types'

// Plain client fetch; HTTP caching comes from the API's Cache-Control + React Query staleTime.

export async function getAllProducts(): Promise<Product[]> {
  try {
    const res = await apiFetch<{ products: Product[] }>('/products')
    return res.products || []
  } catch (e) {
    console.error('Failed to fetch all products:', e)
    return []
  }
}

export async function getProductById(id: string): Promise<Product | undefined> {
  try {
    const res = await apiFetch<{ product: Product }>(`/products/${id}`)
    return res.product
  } catch (e) {
    console.error(`Failed to fetch product ${id}:`, e)
    return undefined
  }
}

export async function getProductsByCategory(category: string): Promise<Product[]> {
  try {
    const res = await apiFetch<{ products: Product[] }>(`/products?category=${category}`)
    return res.products || []
  } catch (e) {
    console.error(`Failed to fetch products for category ${category}:`, e)
    return []
  }
}

export async function getFeaturedProducts(): Promise<Product[]> {
  try {
    const res = await apiFetch<{ products: Product[] }>('/products?featured=true')
    return res.products || []
  } catch (e) {
    console.error('Failed to fetch featured products:', e)
    return []
  }
}

export async function getNewArrivals(): Promise<Product[]> {
  try {
    const res = await apiFetch<{ products: Product[] }>('/products?newArrivals=true')
    return res.products || []
  } catch (e) {
    console.error('Failed to fetch new arrivals:', e)
    return []
  }
}

export async function getBestSellers(): Promise<Product[]> {
  try {
    const res = await apiFetch<{ products: Product[] }>('/products?bestSellers=true')
    return res.products || []
  } catch (e) {
    console.error('Failed to fetch best sellers:', e)
    return []
  }
}

export const PRODUCTS: Product[] = []
