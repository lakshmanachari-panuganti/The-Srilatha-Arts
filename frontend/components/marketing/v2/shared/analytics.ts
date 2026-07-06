'use client'

/**
 * v2 analytics shim - shared across exhibition rooms.
 *
 * Pushes typed events into window.dataLayer (GA4) and, when window.fbq
 * is present, into Meta Pixel. No-op if neither is wired so the rooms
 * remain measurable from day one and "wake up" the moment either tag is
 * installed in app/layout.tsx - no per-room change needed.
 *
 * Add a new room here:
 *   1. Add its source to AnalyticsSource
 *   2. Add any room-specific events to TrackEvent
 *   3. Map to the closest Meta standard event in META_MAP if useful
 *
 * The narrow `source` typing prevents drift - every room declares which
 * source it identifies as, and GA4 / our admin reporting can attribute
 * conversion back to the originating room cleanly.
 */

export type AnalyticsSource =
  | 'featured_works'
  | 'process_film'
  | 'transformations'

export type TrackEvent =
  | { name: 'view_item';              params: { item_id: string; item_name: string; price?: number } }
  | { name: 'add_to_cart';            params: { item_id: string; item_name: string; price?: number; source: AnalyticsSource } }
  | { name: 'begin_checkout';         params: { item_id: string; item_name: string; price?: number; source: AnalyticsSource } }
  | { name: 'select_item';            params: { item_id: string; item_name: string; source: AnalyticsSource } }
  | { name: 'whatsapp_inquiry';       params: { item_id?: string; item_name: string; source: AnalyticsSource } }
  | { name: 'commission_inquiry';     params: { item_id?: string; item_name: string; source: AnalyticsSource } }
  | { name: 'reveal_drag';            params: { item_id?: string; item_name: string; final_position: number } }
  | { name: 'view_film_chapter';      params: { chapter_no: string; chapter_title: string; film_slug: string } }
  | { name: 'film_complete';          params: { film_slug: string; total_hours: number } }
  | { name: 'film_skip_to_commerce';  params: { film_slug: string } }

interface DataLayerWindow extends Window {
  dataLayer?: Array<{ event: string; [k: string]: unknown }>
  fbq?: (
    action: string,
    eventName: string,
    params?: Record<string, unknown>,
  ) => void
}

const META_MAP: Partial<Record<TrackEvent['name'], string>> = {
  view_item: 'ViewContent',
  add_to_cart: 'AddToCart',
  begin_checkout: 'InitiateCheckout',
  whatsapp_inquiry: 'Contact',
  commission_inquiry: 'Lead',
}

export function trackEvent(evt: TrackEvent): void {
  if (typeof window === 'undefined') return
  const w = window as DataLayerWindow

  if (Array.isArray(w.dataLayer)) {
    w.dataLayer.push({ event: evt.name, ...evt.params })
  }
  if (typeof w.fbq === 'function') {
    const metaName = META_MAP[evt.name]
    if (metaName) w.fbq('track', metaName, evt.params as Record<string, unknown>)
  }
}

/** Indian currency formatter - proper lakh comma grouping (₹ 1,50,000). */
export function formatINR(amount: number): string {
  const f = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  })
  return f.format(amount).replace('₹', '₹ ')
}
