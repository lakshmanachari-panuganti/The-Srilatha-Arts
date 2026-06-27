/**
 * Shared coupon evaluation.
 *
 * Single source of truth for "can this coupon be applied to this cart?".
 * Used by:
 *   - POST /api/coupons/validate   (preview before checkout)
 *   - POST /api/razorpay/create-order  (authoritative discount at payment time)
 *
 * Pricing is always done in PAISE. Callers passing rupee values must convert.
 */

import type { InvocationContext } from '@azure/functions'
import { getCoupon, getCouponRedemptionsByUser, Row } from './tableStorage'
import { getShippingConfig, computeShippingAmount } from './shippingConfig'

export interface EvaluateItem {
  productId: string
  category: string
  price: number   // paise
  qty: number
}

export interface EvaluateInvalid {
  valid: false
  reason: 'INVALID' | 'INACTIVE' | 'EXPIRED' | 'USED' | 'MIN_SPEND' | 'UNSUPPORTED'
  message: string
}

export interface EvaluateValid {
  valid: true
  code: string
  discountAmount: number   // paise
  appliedTo: 'cart' | 'shipping'
  message: string
}

export type EvaluateResult = EvaluateInvalid | EvaluateValid

/**
 * Evaluate a coupon code against a concrete cart and the authenticated user.
 * Returns `{ valid: true, discountAmount, appliedTo }` if it can be applied,
 * otherwise `{ valid: false, reason, message }` ready to be surfaced.
 *
 * userId is optional; per-user / first-time-only checks degrade safely when
 * absent (per-user is skipped, first-time is rejected with a sign-in prompt).
 */
export async function evaluateCoupon(
  rawCode: string,
  items: EvaluateItem[],
  userId: string | undefined,
  context?: InvocationContext,
): Promise<EvaluateResult> {
  const code = rawCode.toUpperCase().trim()

  const coupon = await getCoupon(code)
  if (!coupon) {
    return { valid: false, reason: 'INVALID', message: 'This coupon code does not exist' }
  }

  if (coupon.active === false) {
    return { valid: false, reason: 'INACTIVE', message: 'This coupon is no longer active' }
  }

  const now = Date.now()
  if (coupon.startDate && new Date(String(coupon.startDate)).getTime() > now) {
    return { valid: false, reason: 'INACTIVE', message: 'This coupon is not yet active' }
  }
  if (coupon.endDate && new Date(String(coupon.endDate)).getTime() < now) {
    return { valid: false, reason: 'EXPIRED', message: 'This coupon has expired' }
  }

  if (coupon.usageLimit && (coupon.currentUsage ?? 0) >= coupon.usageLimit) {
    return { valid: false, reason: 'USED', message: 'This coupon has reached its usage limit' }
  }

  if (userId && coupon.perUserLimit) {
    const userRedemptions = await getCouponRedemptionsByUser(code, userId)
    if (userRedemptions.length >= coupon.perUserLimit) {
      return { valid: false, reason: 'USED', message: 'You have already used this coupon' }
    }
  }

  if (coupon.firstTimeOnly) {
    if (!userId) {
      return { valid: false, reason: 'INACTIVE', message: 'Please sign in to apply this coupon' }
    }
    const allRedemptions = await getCouponRedemptionsByUser(code, userId)
    if (allRedemptions.length > 0) {
      return { valid: false, reason: 'USED', message: 'This coupon is for first-time buyers only' }
    }
  }

  let cartTotal = 0
  for (const item of items) cartTotal += item.price * item.qty

  if (coupon.minOrderAmount && cartTotal < coupon.minOrderAmount) {
    const needed = ((coupon.minOrderAmount - cartTotal) / 100).toFixed(0)
    return {
      valid: false,
      reason: 'MIN_SPEND',
      message: `Minimum order ₹${(coupon.minOrderAmount / 100).toFixed(0)} required (add ₹${needed} more)`,
    }
  }

  let discount = 0
  let appliedTo: 'cart' | 'shipping' = 'cart'

  switch (coupon.type) {
    case 'PERCENTAGE':
      discount = Math.floor(cartTotal * ((coupon.value as number) / 100))
      if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount as number)
      break
    case 'FIXED_AMOUNT':
      discount = coupon.value as number
      break
    case 'FREE_SHIPPING': {
      const cfg = await getShippingConfig()
      discount = computeShippingAmount(cartTotal, cfg)
      appliedTo = 'shipping'
      break
    }
    default:
      context?.warn?.(`evaluateCoupon: coupon "${code}" has unsupported type "${coupon.type}" - treating as invalid`)
      return {
        valid: false,
        reason: 'UNSUPPORTED',
        message: 'This coupon type is not currently supported',
      }
  }

  return {
    valid: true,
    code,
    discountAmount: discount,
    appliedTo,
    message: (coupon.description as string) || `Coupon ${code} applied!`,
  }
}

/** Coupon row type re-export so callers don't need to import from tableStorage. */
export type CouponRow = Row
