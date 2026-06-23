'use client'

import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

/**
 * Shape served by GET /api/shipping-settings. Mirrors the admin-configurable
 * shipping config stored in Azure Tables (config/shipping). All amounts are
 * in paise; rupee callers divide by 100.
 */
export interface ShippingConfig {
  baseCharge: number       // paise - standard (strike-through) charge
  effectiveCharge: number  // paise - what we actually bill
  freeThreshold: number    // paise - cart subtotal at/above which shipping is free
  discountLabel?: string
}

interface ShippingConfigResponse {
  shipping: ShippingConfig
}

/**
 * Single source of truth for the live shipping config across the site.
 *
 * The admin sets `freeThreshold`, `baseCharge`, `effectiveCharge` via
 * /admin/settings → that PATCHes /api/admin/shipping-settings → reads back
 * from the same Azure Tables row this hook serves. Cart, checkout, FAQ,
 * hero strip, product detail strip, shipping-and-returns page all consume
 * this hook so changing one number in the admin UI propagates everywhere.
 *
 * React Query's cache dedupes concurrent calls on the same page and the
 * 5-minute staleTime keeps the threshold consistent across route changes.
 */
export function useShippingConfig() {
  return useQuery<ShippingConfigResponse>({
    queryKey: ['shipping-settings'],
    queryFn: () => apiFetch<ShippingConfigResponse>('/shipping-settings'),
    staleTime: 5 * 60_000,
  })
}
