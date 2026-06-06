/**
 * Unit tests for services/orderState.ts
 *
 * Pure functions - no I/O, no Azure SDK, no environment variables needed.
 * Run with: npm test
 */

import {
  canTransition,
  nextValidStates,
  isValidStatus,
  validateTransitionPayload,
  getTransitionNotifications,
  statusLabel,
  canCustomerCancel,
  canCustomerReturn,
  ALL_STATUSES,
} from '../services/orderState'
import type { OrderStatus } from '../types'

// ─── canTransition ────────────────────────────────────────────────────────────

describe('canTransition', () => {
  describe('forward happy path', () => {
    const happyPath: [OrderStatus, OrderStatus][] = [
      ['PLACED',           'CONFIRMED'],
      ['CONFIRMED',        'CRAFTING'],
      ['CRAFTING',         'PACKED'],
      ['PACKED',           'SHIPPED'],
      ['SHIPPED',          'OUT_FOR_DELIVERY'],
      ['OUT_FOR_DELIVERY', 'DELIVERED'],
      ['DELIVERED',        'RETURN_REQUESTED'],
      ['RETURN_REQUESTED', 'RETURNED'],
      ['RETURNED',         'REFUNDED'],
    ]

    test.each(happyPath)('%s → %s is allowed', (from, to) => {
      expect(canTransition(from, to)).toBe(true)
    })
  })

  describe('cancellation and hold branches', () => {
    it('PLACED can be CANCELLED', () => expect(canTransition('PLACED', 'CANCELLED')).toBe(true))
    it('CONFIRMED can be CANCELLED', () => expect(canTransition('CONFIRMED', 'CANCELLED')).toBe(true))
    it('CRAFTING can be CANCELLED', () => expect(canTransition('CRAFTING', 'CANCELLED')).toBe(true))
    it('PLACED can go ON_HOLD', () => expect(canTransition('PLACED', 'ON_HOLD')).toBe(true))
    it('ON_HOLD can be CONFIRMED', () => expect(canTransition('ON_HOLD', 'CONFIRMED')).toBe(true))
    it('ON_HOLD can be CANCELLED', () => expect(canTransition('ON_HOLD', 'CANCELLED')).toBe(true))
    it('RETURN_REQUESTED can revert to DELIVERED (admin rejects return)', () => {
      expect(canTransition('RETURN_REQUESTED', 'DELIVERED')).toBe(true)
    })
  })

  describe('illegal skips', () => {
    it('PLACED cannot jump to SHIPPED', () => expect(canTransition('PLACED', 'SHIPPED')).toBe(false))
    it('PLACED cannot jump to DELIVERED', () => expect(canTransition('PLACED', 'DELIVERED')).toBe(false))
    it('CRAFTING cannot go to DELIVERED directly', () => expect(canTransition('CRAFTING', 'DELIVERED')).toBe(false))
  })

  describe('terminal states have no exits', () => {
    it('CANCELLED has no allowed transitions', () => {
      for (const s of ALL_STATUSES) {
        expect(canTransition('CANCELLED', s)).toBe(false)
      }
    })
    it('REFUNDED has no allowed transitions', () => {
      for (const s of ALL_STATUSES) {
        expect(canTransition('REFUNDED', s)).toBe(false)
      }
    })
  })

  describe('backward / nonsense transitions', () => {
    it('DELIVERED cannot go back to SHIPPED', () => expect(canTransition('DELIVERED', 'SHIPPED')).toBe(false))
    it('SHIPPED cannot go back to PLACED', () => expect(canTransition('SHIPPED', 'PLACED')).toBe(false))
    it('CONFIRMED cannot go to PLACED', () => expect(canTransition('CONFIRMED', 'PLACED')).toBe(false))
  })
})

// ─── nextValidStates ──────────────────────────────────────────────────────────

describe('nextValidStates', () => {
  it('PLACED has exactly 3 next states', () => {
    const next = nextValidStates('PLACED')
    expect(next).toHaveLength(3)
    expect(next).toContain('CONFIRMED')
    expect(next).toContain('CANCELLED')
    expect(next).toContain('ON_HOLD')
  })

  it('OUT_FOR_DELIVERY has only DELIVERED', () => {
    expect(nextValidStates('OUT_FOR_DELIVERY')).toEqual(['DELIVERED'])
  })

  it('CANCELLED returns empty array', () => {
    expect(nextValidStates('CANCELLED')).toEqual([])
  })

  it('REFUNDED returns empty array', () => {
    expect(nextValidStates('REFUNDED')).toEqual([])
  })
})

// ─── isValidStatus ────────────────────────────────────────────────────────────

describe('isValidStatus', () => {
  it('accepts all known statuses', () => {
    for (const s of ALL_STATUSES) {
      expect(isValidStatus(s)).toBe(true)
    }
  })

  it('rejects unknown strings', () => {
    expect(isValidStatus('UNKNOWN')).toBe(false)
    expect(isValidStatus('')).toBe(false)
    expect(isValidStatus('placed')).toBe(false)   // case-sensitive
    expect(isValidStatus('PROCESSING')).toBe(false)
  })
})

// ─── validateTransitionPayload ────────────────────────────────────────────────

describe('validateTransitionPayload', () => {
  describe('SHIPPED requires tracking and courier', () => {
    it('rejects empty payload', () => {
      expect(validateTransitionPayload('SHIPPED', {})).not.toBeNull()
    })
    it('rejects payload with only tracking (no courier)', () => {
      expect(validateTransitionPayload('SHIPPED', { tracking: 'TRK123' })).not.toBeNull()
    })
    it('rejects payload with only courier (no tracking)', () => {
      expect(validateTransitionPayload('SHIPPED', { courier: 'BlueDart' })).not.toBeNull()
    })
    it('accepts payload with both tracking and courier', () => {
      expect(validateTransitionPayload('SHIPPED', { tracking: 'TRK123', courier: 'BlueDart' })).toBeNull()
    })
  })

  describe('CANCELLED requires cancelReason', () => {
    it('rejects missing reason', () => {
      expect(validateTransitionPayload('CANCELLED', {})).not.toBeNull()
    })
    it('accepts with reason', () => {
      expect(validateTransitionPayload('CANCELLED', { cancelReason: 'Customer request' })).toBeNull()
    })
  })

  describe('ON_HOLD requires holdReason', () => {
    it('rejects missing reason', () => {
      expect(validateTransitionPayload('ON_HOLD', {})).not.toBeNull()
    })
    it('accepts with reason', () => {
      expect(validateTransitionPayload('ON_HOLD', { holdReason: 'Payment pending' })).toBeNull()
    })
  })

  describe('REFUNDED requires refundAmount > 0', () => {
    it('rejects missing amount', () => {
      expect(validateTransitionPayload('REFUNDED', {})).not.toBeNull()
    })
    it('rejects zero amount', () => {
      expect(validateTransitionPayload('REFUNDED', { refundAmount: 0 })).not.toBeNull()
    })
    it('rejects negative amount', () => {
      expect(validateTransitionPayload('REFUNDED', { refundAmount: -100 })).not.toBeNull()
    })
    it('accepts positive refund amount', () => {
      expect(validateTransitionPayload('REFUNDED', { refundAmount: 50000 })).toBeNull()
    })
  })

  describe('states with no requirements', () => {
    const noRequirements: OrderStatus[] = ['CONFIRMED', 'CRAFTING', 'PACKED', 'DELIVERED', 'RETURNED']
    test.each(noRequirements)('%s accepts empty payload', (status) => {
      expect(validateTransitionPayload(status, {})).toBeNull()
    })
  })
})

// ─── getTransitionNotifications ───────────────────────────────────────────────

describe('getTransitionNotifications', () => {
  it('CONFIRMED is silent (customer was already notified at PLACED)', () => {
    const n = getTransitionNotifications('CONFIRMED')
    expect(n.customer).toEqual([])
  })

  it('SHIPPED notifies customer via whatsapp + email', () => {
    const n = getTransitionNotifications('SHIPPED')
    expect(n.customer).toContain('whatsapp')
    expect(n.customer).toContain('email')
  })

  it('OUT_FOR_DELIVERY does not send WhatsApp (courier owns that touchpoint)', () => {
    const n = getTransitionNotifications('OUT_FOR_DELIVERY')
    expect(n.customer).not.toContain('whatsapp')
  })

  it('DELIVERED does not send a WhatsApp but schedules a review request', () => {
    const n = getTransitionNotifications('DELIVERED')
    expect(n.customer).not.toContain('whatsapp')
    expect(n.scheduleReviewRequest).toBe(true)
  })

  it('CANCELLED, ON_HOLD, REFUNDED still notify customer via whatsapp', () => {
    expect(getTransitionNotifications('CANCELLED').customer).toContain('whatsapp')
    expect(getTransitionNotifications('ON_HOLD').customer).toContain('whatsapp')
    expect(getTransitionNotifications('REFUNDED').customer).toContain('whatsapp')
  })

  it('PLACED (no entry in map) returns empty customer array', () => {
    const n = getTransitionNotifications('PLACED')
    expect(n.customer).toEqual([])
    expect(n.internal).toEqual([])
  })
})

// ─── statusLabel ──────────────────────────────────────────────────────────────

describe('statusLabel', () => {
  it('returns human-readable label for known statuses', () => {
    expect(statusLabel('PLACED')).toBe('Order Placed')
    expect(statusLabel('CRAFTING')).toBe('Being Crafted')
    expect(statusLabel('OUT_FOR_DELIVERY')).toBe('Out for Delivery')
    expect(statusLabel('RETURN_REQUESTED')).toBe('Return Requested')
    expect(statusLabel('CANCELLED')).toBe('Cancelled')
  })

  it('returns the raw status string as fallback for unknown values', () => {
    // TypeScript won't normally allow this but cast to test the fallback.
    expect(statusLabel('UNKNOWN_STATUS' as OrderStatus)).toBe('UNKNOWN_STATUS')
  })
})

// ─── canCustomerCancel ────────────────────────────────────────────────────────

describe('canCustomerCancel', () => {
  it('allows cancel for PLACED', () => expect(canCustomerCancel('PLACED')).toBe(true))
  it('allows cancel for CONFIRMED', () => expect(canCustomerCancel('CONFIRMED')).toBe(true))
  it('allows cancel for CRAFTING', () => expect(canCustomerCancel('CRAFTING')).toBe(true))

  const nonCancellable: OrderStatus[] = ['PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REFUNDED']
  test.each(nonCancellable)('disallows cancel for %s', (status) => {
    expect(canCustomerCancel(status)).toBe(false)
  })
})

// ─── canCustomerReturn ────────────────────────────────────────────────────────

describe('canCustomerReturn', () => {
  const daysAgo = (n: number) =>
    new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString()

  it('allows return 1 day after delivery', () => {
    expect(canCustomerReturn('DELIVERED', daysAgo(1))).toBe(true)
  })

  it('allows return exactly 7 days after delivery', () => {
    // 7 days = exactly at the boundary (inclusive)
    expect(canCustomerReturn('DELIVERED', daysAgo(7))).toBe(true)
  })

  it('disallows return 8 days after delivery (outside 7-day window)', () => {
    expect(canCustomerReturn('DELIVERED', daysAgo(8))).toBe(false)
  })

  it('disallows return for non-DELIVERED status', () => {
    expect(canCustomerReturn('SHIPPED', daysAgo(1))).toBe(false)
    expect(canCustomerReturn('CANCELLED', daysAgo(1))).toBe(false)
    expect(canCustomerReturn('RETURN_REQUESTED', daysAgo(1))).toBe(false)
  })

  it('disallows return when deliveredAt is missing', () => {
    expect(canCustomerReturn('DELIVERED', undefined)).toBe(false)
  })

  it('disallows return when deliveredAt is an empty string', () => {
    expect(canCustomerReturn('DELIVERED', '')).toBe(false)
  })
})
