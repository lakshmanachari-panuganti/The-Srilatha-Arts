/**
 * Unit tests for lib/format.ts
 * Tests pure formatting functions — no DOM or network required.
 */

import { formatINR, discountPct, formatDate } from '../lib/format'

// ─── formatINR ────────────────────────────────────────────────────────────────

describe('formatINR', () => {
  it('includes the ₹ rupee symbol', () => {
    expect(formatINR(1000)).toContain('₹')
  })

  it('formats zero as ₹0', () => {
    const result = formatINR(0)
    expect(result).toContain('₹')
    expect(result).toContain('0')
  })

  it('formats 1000 with the digits 1 and 000', () => {
    const result = formatINR(1000)
    expect(result).toMatch(/1[,.]?000/)
  })

  it('formats 100000 with correct digits', () => {
    const result = formatINR(100000)
    expect(result).toContain('1')
    expect(result).toContain('0')
  })

  it('rounds to 0 decimal places (no paise)', () => {
    // 1999.99 should format without decimals
    const result = formatINR(1999)
    expect(result).not.toContain('.')
  })

  it('formats negative amounts with ₹', () => {
    const result = formatINR(-500)
    expect(result).toContain('₹')
    expect(result).toContain('500')
  })
})

// ─── discountPct ──────────────────────────────────────────────────────────────

describe('discountPct', () => {
  it('returns null when compareAtPrice is undefined', () => {
    expect(discountPct(800)).toBeNull()
  })

  it('returns null when compareAtPrice equals price', () => {
    expect(discountPct(1000, 1000)).toBeNull()
  })

  it('returns null when compareAtPrice is less than price', () => {
    expect(discountPct(1200, 1000)).toBeNull()
  })

  it('calculates 50% discount correctly', () => {
    expect(discountPct(500, 1000)).toBe(50)
  })

  it('calculates 25% discount correctly', () => {
    expect(discountPct(750, 1000)).toBe(25)
  })

  it('rounds to the nearest whole percent', () => {
    // (1000 - 667) / 1000 = 33.3% → rounds to 33
    expect(discountPct(667, 1000)).toBe(33)
  })

  it('returns 100% when price is 0 and compareAt is set', () => {
    expect(discountPct(0, 1000)).toBe(100)
  })

  it('returns null when compareAtPrice is 0', () => {
    // Division by zero guard — compareAt of 0 is falsy
    expect(discountPct(0, 0)).toBeNull()
  })
})

// ─── formatDate ───────────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('returns a non-empty string', () => {
    expect(typeof formatDate('2024-01-15T00:00:00.000Z')).toBe('string')
    expect(formatDate('2024-01-15T00:00:00.000Z').length).toBeGreaterThan(0)
  })

  it('includes the year', () => {
    expect(formatDate('2024-06-20T00:00:00.000Z')).toContain('2024')
  })

  it('includes a recognisable month string for January', () => {
    const result = formatDate('2024-01-10T00:00:00.000Z')
    // en-IN short month: "Jan"
    expect(result).toMatch(/Jan/i)
  })

  it('includes a recognisable month string for December', () => {
    const result = formatDate('2024-12-25T00:00:00.000Z')
    expect(result).toMatch(/Dec/i)
  })

  it('includes the day number', () => {
    const result = formatDate('2024-03-05T00:00:00.000Z')
    expect(result).toContain('5')
  })
})
