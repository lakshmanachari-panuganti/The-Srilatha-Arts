/**
 * Admin-controlled shipping configuration.
 *
 * Stored in the existing `config` table (partitionKey='config',
 * rowKey='shipping'). All amounts are in PAISE so they line up with how
 * orders / coupons store money elsewhere. The admin UI converts to/from
 * rupees on save.
 *
 * The "discount" UX (struck-through standard charge vs effective charge)
 * is built into the model on purpose so the cart can render
 *
 *   Shipping  ₹99  ₹49   Festive offer
 *
 * without the cart having to know anything about coupons or the admin
 * having to fake the regular price.
 */

import { getConfig, setConfig } from './tableStorage'

export interface ShippingConfig {
  baseCharge: number      // paise - "regular" price, shown as the strike-through
  effectiveCharge: number // paise - what we actually bill (≤ baseCharge)
  freeThreshold: number   // paise - free shipping above this cart subtotal
  discountLabel?: string  // optional short banner text shown on the cart
                          //   when effectiveCharge < baseCharge
}

export const DEFAULT_SHIPPING_CONFIG: ShippingConfig = {
  baseCharge: 9900,
  effectiveCharge: 9900,
  freeThreshold: 299900,
}

const CONFIG_KEY = 'shipping'

/**
 * Read the admin-configured shipping settings. Returns defaults if the
 * config row hasn't been written yet or is malformed.
 */
export async function getShippingConfig(): Promise<ShippingConfig> {
  try {
    const raw = await getConfig(CONFIG_KEY)
    if (!raw || typeof raw !== 'object') return { ...DEFAULT_SHIPPING_CONFIG }
    return normalise(raw)
  } catch {
    return { ...DEFAULT_SHIPPING_CONFIG }
  }
}

/**
 * Persist new shipping settings. Caller is responsible for admin auth +
 * CSRF + input validation (see functions/shippingSettings.ts).
 */
export async function setShippingConfig(next: ShippingConfig): Promise<ShippingConfig> {
  const cleaned = normalise(next)
  await setConfig(CONFIG_KEY, cleaned)
  return cleaned
}

/**
 * Compute the shipping amount in paise for a given cart subtotal under a
 * given configuration. Pure function - used by orders.ts, payments.ts,
 * and any future order-recompute logic.
 */
export function computeShippingAmount(subtotalPaise: number, cfg: ShippingConfig): number {
  if (subtotalPaise <= 0) return 0
  if (cfg.freeThreshold > 0 && subtotalPaise >= cfg.freeThreshold) return 0
  // effectiveCharge is the source of truth for what we actually bill.
  return Math.max(0, Math.floor(cfg.effectiveCharge))
}

/**
 * Coerce arbitrary stored / submitted data into a well-formed config.
 * Keeps invariants: integers, non-negative, effective ≤ base.
 */
function normalise(input: any): ShippingConfig {
  const base = nonNegInt(input.baseCharge, DEFAULT_SHIPPING_CONFIG.baseCharge)
  let effective = nonNegInt(input.effectiveCharge, base)
  // Effective cannot exceed base - otherwise the strike-through UI would
  // show a "discount" that's actually a markup.
  if (effective > base) effective = base
  const threshold = nonNegInt(input.freeThreshold, DEFAULT_SHIPPING_CONFIG.freeThreshold)
  const label =
    typeof input.discountLabel === 'string' && input.discountLabel.trim().length > 0
      ? input.discountLabel.trim().slice(0, 80)
      : undefined
  const out: ShippingConfig = {
    baseCharge: base,
    effectiveCharge: effective,
    freeThreshold: threshold,
  }
  if (label) out.discountLabel = label
  return out
}

function nonNegInt(val: unknown, fallback: number): number {
  const n = Number(val)
  if (!Number.isFinite(n) || n < 0) return fallback
  return Math.floor(n)
}
