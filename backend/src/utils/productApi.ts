/**
 * Storage Row -> public product API shape.
 *
 * Lives here rather than in functions/products.ts because two route
 * modules need it: the public listing and the admin listing. Importing it
 * from products.ts would mean productAdmin.ts pulls in a module whose
 * top-level code registers HTTP routes — harmless today thanks to Node's
 * module cache, but a needless coupling between two route files and an
 * easy way to create an import cycle later.
 *
 * Keeping one mapper (rather than one per caller) is deliberate: the
 * admin UI types its response with the same `Product` interface as the
 * storefront, so two hand-maintained mappers would silently drift.
 */

import type { Row } from '../services/tableStorage'

function safeArray(json: unknown): string[] {
  if (!json) return []
  if (Array.isArray(json)) return json as string[]
  try {
    const parsed = JSON.parse(String(json))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function toApi(row: Row) {
  return {
    id: row.rowKey,
    slug: row.slug || row.rowKey,
    title: row.title,
    category: row.partitionKey,
    price: row.displayPrice ?? row.price,
    compareAtPrice: row.compareAtPrice ?? undefined,
    size: row.size,
    material: row.material,
    timeToMake: row.timeToMake || '5 days',
    description: row.description,
    shortDescription: row.shortDescription || row.description?.slice(0, 120),
    careInstructions: row.careInstructions || '',
    images: [row.imageUrl, ...safeArray(row.additionalImages)].filter(Boolean),
    inStock: row.inStock !== false,
    stockQty: row.stockQty ?? 0,
    featured: row.featured === true,
    isNewArrival: row.isNewArrival === true,
    isBestSeller: row.isBestSeller === true,
    isOnSale: row.compareAtPrice ? row.compareAtPrice > (row.displayPrice ?? row.price) : false,
    rating: row.rating ?? undefined,
    reviewCount: row.reviewCount ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}
