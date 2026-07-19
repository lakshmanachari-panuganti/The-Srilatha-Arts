/**
 * Revenue-critical tests for services/couponEvaluation (audit M2).
 *
 * Coupons touch the final amount the customer is charged, so a subtle
 * regression here refunds the studio's margin. The pricing math is all
 * in paise; these tests pin the paise/rupee boundary, the min-spend
 * gate, and the per-coupon-type math.
 */

import { jest } from '@jest/globals'

// Coupons the tests set up in-memory. `type` matches the same shape used
// by the real Table Storage rows in the coupon admin flow.
type MockCoupon = {
  rowKey: string
  active: boolean
  type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING' | 'UNSUPPORTED'
  value?: number
  maxDiscount?: number
  minOrderAmount?: number
  usageLimit?: number
  currentUsage?: number
  perUserLimit?: number
  firstTimeOnly?: boolean
  startDate?: string
  endDate?: string
  description?: string
}

const coupons = new Map<string, MockCoupon>()
const userRedemptions = new Map<string, unknown[]>()
const usersWithPriorPurchase = new Set<string>()

jest.mock('../services/tableStorage', () => ({
  getCoupon: jest.fn(async (code: string) => coupons.get(code) ?? null),
  getCouponRedemptionsByUser: jest.fn(async (code: string, uid: string) =>
    userRedemptions.get(`${code}|${uid}`) ?? [],
  ),
  hasPriorCapturedOrder: jest.fn(async (uid: string) => usersWithPriorPurchase.has(uid)),
}))

// Shipping config uses a live env-driven module. Mock it to a fixed shape
// so the coupon path doesn't depend on shipping admin config.
jest.mock('../services/shippingConfig', () => ({
  getShippingConfig: jest.fn(async () => ({
    baseCharge: 12000,
    effectiveCharge: 12000,
    freeThreshold: 200000,
  })),
  computeShippingAmount: (subtotal: number, cfg: { effectiveCharge: number; freeThreshold: number }) =>
    subtotal >= cfg.freeThreshold ? 0 : cfg.effectiveCharge,
}))

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { evaluateCoupon } = require('../services/couponEvaluation') as {
  evaluateCoupon: (
    code: string,
    items: { productId: string; category: string; price: number; qty: number }[],
    userId: string | undefined,
  ) => Promise<{ valid: boolean; discountAmount?: number; appliedTo?: string; reason?: string; message?: string; code?: string }>
}

const cart = (priceP: number, qty = 1) => [
  { productId: 'p1', category: 'resin', price: priceP, qty },
]

beforeEach(() => {
  coupons.clear()
  userRedemptions.clear()
  usersWithPriorPurchase.clear()
})

describe('evaluateCoupon — invalid states', () => {
  it('unknown code → INVALID', async () => {
    const r = await evaluateCoupon('NOPE', cart(100000), undefined)
    expect(r.valid).toBe(false)
    expect(r.reason).toBe('INVALID')
  })

  it('inactive coupon → INACTIVE', async () => {
    coupons.set('OFF10', { rowKey: 'OFF10', active: false, type: 'PERCENTAGE', value: 10 })
    const r = await evaluateCoupon('OFF10', cart(100000), undefined)
    expect(r.valid).toBe(false)
    expect(r.reason).toBe('INACTIVE')
  })

  it('expired end date → EXPIRED', async () => {
    coupons.set('OLD', {
      rowKey: 'OLD',
      active: true,
      type: 'PERCENTAGE',
      value: 10,
      endDate: new Date(Date.now() - 60_000).toISOString(),
    })
    const r = await evaluateCoupon('OLD', cart(100000), undefined)
    expect(r.reason).toBe('EXPIRED')
  })

  it('below minOrderAmount → MIN_SPEND with amount-to-add', async () => {
    coupons.set('SAVE500', {
      rowKey: 'SAVE500',
      active: true,
      type: 'FIXED_AMOUNT',
      value: 50000,
      minOrderAmount: 200000, // ₹2000
    })
    // Cart of ₹1000
    const r = await evaluateCoupon('SAVE500', cart(100000), undefined)
    expect(r.reason).toBe('MIN_SPEND')
    expect(r.message).toContain('₹2000')
    expect(r.message).toContain('₹1000') // needs 1000 more
  })

  it('usage-limit reached → USED', async () => {
    coupons.set('CAP', {
      rowKey: 'CAP',
      active: true,
      type: 'FIXED_AMOUNT',
      value: 10000,
      usageLimit: 5,
      currentUsage: 5,
    })
    const r = await evaluateCoupon('CAP', cart(100000), undefined)
    expect(r.reason).toBe('USED')
  })

  it('per-user-limit reached → USED', async () => {
    coupons.set('ONEPERU', {
      rowKey: 'ONEPERU',
      active: true,
      type: 'FIXED_AMOUNT',
      value: 10000,
      perUserLimit: 1,
    })
    userRedemptions.set('ONEPERU|e@x.io', [{ id: 'r1' }])
    const r = await evaluateCoupon('ONEPERU', cart(100000), 'e@x.io')
    expect(r.reason).toBe('USED')
  })
})

describe('evaluateCoupon — discount math (paise/rupee boundary is load-bearing)', () => {
  it('PERCENTAGE 10% off ₹1000 subtotal = ₹100 = 10000 paise', async () => {
    coupons.set('OFF10', { rowKey: 'OFF10', active: true, type: 'PERCENTAGE', value: 10 })
    const r = await evaluateCoupon('OFF10', cart(100000), undefined)
    expect(r.valid).toBe(true)
    expect(r.discountAmount).toBe(10000)
    expect(r.appliedTo).toBe('cart')
  })

  it('PERCENTAGE 20% of ₹500 rounds down (Math.floor)', async () => {
    coupons.set('OFF20', { rowKey: 'OFF20', active: true, type: 'PERCENTAGE', value: 20 })
    // ₹5.03 = 503 paise. 20% = 100.6 → floor 100.
    const r = await evaluateCoupon('OFF20', [
      { productId: 'p1', category: 'c', price: 503, qty: 1 },
    ], undefined)
    expect(r.discountAmount).toBe(100)
  })

  it('PERCENTAGE capped by maxDiscount', async () => {
    coupons.set('BIG', {
      rowKey: 'BIG',
      active: true,
      type: 'PERCENTAGE',
      value: 50,
      maxDiscount: 20000, // ₹200
    })
    // 50% of ₹1000 = ₹500 → capped at ₹200 = 20000 paise
    const r = await evaluateCoupon('BIG', cart(100000), undefined)
    expect(r.discountAmount).toBe(20000)
  })

  it('FIXED_AMOUNT returns the exact paise value', async () => {
    coupons.set('FLAT500', {
      rowKey: 'FLAT500',
      active: true,
      type: 'FIXED_AMOUNT',
      value: 50000, // ₹500
    })
    const r = await evaluateCoupon('FLAT500', cart(100000), undefined)
    expect(r.discountAmount).toBe(50000)
    expect(r.appliedTo).toBe('cart')
  })

  it('FREE_SHIPPING applies the current shipping charge and sets appliedTo=shipping', async () => {
    coupons.set('FREESHIP', {
      rowKey: 'FREESHIP',
      active: true,
      type: 'FREE_SHIPPING',
    })
    // Cart of ₹1000 (below free threshold of ₹2000) → shipping = ₹120
    const r = await evaluateCoupon('FREESHIP', cart(100000), undefined)
    expect(r.discountAmount).toBe(12000)
    expect(r.appliedTo).toBe('shipping')
  })

  it('FREE_SHIPPING with cart already above free threshold discounts 0', async () => {
    coupons.set('FREESHIP2', {
      rowKey: 'FREESHIP2',
      active: true,
      type: 'FREE_SHIPPING',
    })
    // Cart of ₹3000 → already free → discountAmount = 0 (nothing to give back)
    const r = await evaluateCoupon('FREESHIP2', cart(300000), undefined)
    expect(r.discountAmount).toBe(0)
    expect(r.appliedTo).toBe('shipping')
  })

  it('UNSUPPORTED type is rejected safely', async () => {
    coupons.set('WEIRD', { rowKey: 'WEIRD', active: true, type: 'UNSUPPORTED', value: 1 })
    const r = await evaluateCoupon('WEIRD', cart(100000), undefined)
    expect(r.reason).toBe('UNSUPPORTED')
  })
})

describe('evaluateCoupon — firstTimeOnly gate', () => {
  it('anonymous user is prompted to sign in', async () => {
    coupons.set('WELCOME10', {
      rowKey: 'WELCOME10',
      active: true,
      type: 'PERCENTAGE',
      value: 10,
      firstTimeOnly: true,
    })
    const r = await evaluateCoupon('WELCOME10', cart(100000), undefined)
    expect(r.valid).toBe(false)
    expect(r.reason).toBe('INACTIVE')
    expect(r.message).toContain('sign in')
  })

  it('brand-new signed-in customer can apply', async () => {
    coupons.set('WELCOME10', {
      rowKey: 'WELCOME10',
      active: true,
      type: 'PERCENTAGE',
      value: 10,
      firstTimeOnly: true,
    })
    const r = await evaluateCoupon('WELCOME10', cart(100000), 'new@buyer.io')
    expect(r.valid).toBe(true)
    expect(r.discountAmount).toBe(10000)
  })

  it('returning customer is rejected even if they never used THIS specific code', async () => {
    // This is the regression the earlier logic missed: the old check only
    // looked at redemptions of the code itself, so a returning buyer who
    // hadn't previously touched WELCOME10 could still redeem it.
    coupons.set('WELCOME10', {
      rowKey: 'WELCOME10',
      active: true,
      type: 'PERCENTAGE',
      value: 10,
      firstTimeOnly: true,
    })
    usersWithPriorPurchase.add('returning@buyer.io')
    const r = await evaluateCoupon('WELCOME10', cart(100000), 'returning@buyer.io')
    expect(r.valid).toBe(false)
    expect(r.reason).toBe('USED')
    expect(r.message).toContain('first-time buyers only')
  })
})

describe('evaluateCoupon — normalisation', () => {
  it('is case-insensitive and trims whitespace', async () => {
    coupons.set('OFF10', { rowKey: 'OFF10', active: true, type: 'PERCENTAGE', value: 10 })
    const r = await evaluateCoupon('  off10  ', cart(100000), undefined)
    expect(r.valid).toBe(true)
    expect(r.code).toBe('OFF10')
  })
})
