/**
 * Unit tests for the invoice URL HMAC token added in services/orderNumber.
 *
 * Covers the cutover bypass for legacy / pre-cutover invoices, the HMAC
 * generation + constant-time verify, and the ?token=... append in
 * invoiceUrlFor.
 */

import {
  INVOICE_TOKEN_CUTOVER,
  invoiceRequiresToken,
  generateInvoiceToken,
  verifyInvoiceToken,
  invoiceUrlFor,
} from '../services/orderNumber'

// Pin a deterministic key for these tests. Real prd value comes from
// Key Vault. We restore the original (unset) state in afterAll so we
// don't leak into other suites.
const TEST_KEY = 'test-invoice-signing-key-unit-tests-only!'
const TEST_KEY_2 = 'a-different-key-than-the-one-above'

describe('INVOICE_TOKEN_CUTOVER', () => {
  it('is the expected 16-digit instant (2026-06-08 00:00:00.00 IST)', () => {
    expect(INVOICE_TOKEN_CUTOVER).toBe('2026060800000000')
    expect(INVOICE_TOKEN_CUTOVER).toMatch(/^\d{16}$/)
  })
})

describe('invoiceRequiresToken', () => {
  it('returns false for non-16-digit legacy IDs (TSA-YYYY-HEX format)', () => {
    expect(invoiceRequiresToken('TSA-2024-AB12')).toBe(false)
    expect(invoiceRequiresToken('TSA-2025-DEAD')).toBe(false)
  })

  it('returns false for 16-digit IDs strictly before the cutover', () => {
    expect(invoiceRequiresToken('2026060700000000')).toBe(false)
    expect(invoiceRequiresToken('2026060723595999')).toBe(false)
    expect(invoiceRequiresToken('2025010100000000')).toBe(false)
  })

  it('returns true for the cutover instant itself', () => {
    expect(invoiceRequiresToken(INVOICE_TOKEN_CUTOVER)).toBe(true)
  })

  it('returns true for 16-digit IDs after the cutover', () => {
    expect(invoiceRequiresToken('2026060800000001')).toBe(true)
    expect(invoiceRequiresToken('2027010112345678')).toBe(true)
  })

  it('returns false for malformed IDs (not 16 digits)', () => {
    expect(invoiceRequiresToken('')).toBe(false)
    expect(invoiceRequiresToken('123')).toBe(false)
    expect(invoiceRequiresToken('20260608000000000')).toBe(false) // 17 digits
    expect(invoiceRequiresToken('202606080000000a')).toBe(false)  // non-digit
  })
})

describe('generateInvoiceToken', () => {
  afterEach(() => {
    delete process.env.INVOICE_SIGNING_KEY
  })

  it('returns null when INVOICE_SIGNING_KEY is unset', () => {
    delete process.env.INVOICE_SIGNING_KEY
    expect(generateInvoiceToken('2026060812345678')).toBeNull()
  })

  it('returns a 32-character lowercase hex string when key is set', () => {
    process.env.INVOICE_SIGNING_KEY = TEST_KEY
    const token = generateInvoiceToken('2026060812345678')
    expect(token).not.toBeNull()
    expect(token).toMatch(/^[0-9a-f]{32}$/)
  })

  it('is deterministic for a given (key, invoice) pair', () => {
    process.env.INVOICE_SIGNING_KEY = TEST_KEY
    expect(generateInvoiceToken('2026060812345678')).toBe(
      generateInvoiceToken('2026060812345678'),
    )
  })

  it('produces different tokens for different invoice numbers', () => {
    process.env.INVOICE_SIGNING_KEY = TEST_KEY
    const a = generateInvoiceToken('2026060812345678')
    const b = generateInvoiceToken('2026060812345679')
    expect(a).not.toBe(b)
  })

  it('produces different tokens when the signing key changes', () => {
    process.env.INVOICE_SIGNING_KEY = TEST_KEY
    const a = generateInvoiceToken('2026060812345678')
    process.env.INVOICE_SIGNING_KEY = TEST_KEY_2
    const b = generateInvoiceToken('2026060812345678')
    expect(a).not.toBe(b)
  })
})

describe('verifyInvoiceToken', () => {
  afterEach(() => {
    delete process.env.INVOICE_SIGNING_KEY
  })

  it('accepts the token produced by generateInvoiceToken (round-trip)', () => {
    process.env.INVOICE_SIGNING_KEY = TEST_KEY
    const invoice = '2026060812345678'
    const token = generateInvoiceToken(invoice)!
    expect(verifyInvoiceToken(invoice, token)).toBe(true)
  })

  it('rejects null / undefined / empty supplied tokens', () => {
    process.env.INVOICE_SIGNING_KEY = TEST_KEY
    expect(verifyInvoiceToken('2026060812345678', null)).toBe(false)
    expect(verifyInvoiceToken('2026060812345678', undefined)).toBe(false)
    expect(verifyInvoiceToken('2026060812345678', '')).toBe(false)
  })

  it('rejects a token signed for a different invoice number', () => {
    process.env.INVOICE_SIGNING_KEY = TEST_KEY
    const tokenForA = generateInvoiceToken('2026060812345678')!
    expect(verifyInvoiceToken('2026060812345679', tokenForA)).toBe(false)
  })

  it('rejects a token of the wrong length (timing-safe pre-check)', () => {
    process.env.INVOICE_SIGNING_KEY = TEST_KEY
    expect(verifyInvoiceToken('2026060812345678', 'abc')).toBe(false)
    expect(verifyInvoiceToken('2026060812345678', 'a'.repeat(64))).toBe(false)
  })

  it('rejects a token when the signing key is not configured', () => {
    delete process.env.INVOICE_SIGNING_KEY
    // Use a 32-char hex string so the early length-check would otherwise pass.
    expect(verifyInvoiceToken('2026060812345678', 'a'.repeat(32))).toBe(false)
  })

  it('rejects a token signed with a different key', () => {
    process.env.INVOICE_SIGNING_KEY = TEST_KEY
    const tokenA = generateInvoiceToken('2026060812345678')!
    process.env.INVOICE_SIGNING_KEY = TEST_KEY_2
    expect(verifyInvoiceToken('2026060812345678', tokenA)).toBe(false)
  })
})

describe('invoiceUrlFor', () => {
  const ORIGINAL_BASE = process.env.INVOICE_PUBLIC_URL_BASE
  const ORIGINAL_SITE = process.env.PUBLIC_SITE_URL

  afterEach(() => {
    delete process.env.INVOICE_SIGNING_KEY
    if (ORIGINAL_BASE === undefined) {
      delete process.env.INVOICE_PUBLIC_URL_BASE
    } else {
      process.env.INVOICE_PUBLIC_URL_BASE = ORIGINAL_BASE
    }
    if (ORIGINAL_SITE === undefined) {
      delete process.env.PUBLIC_SITE_URL
    } else {
      process.env.PUBLIC_SITE_URL = ORIGINAL_SITE
    }
  })

  it('appends ?token=<hmac> when INVOICE_SIGNING_KEY is set', () => {
    process.env.INVOICE_SIGNING_KEY = TEST_KEY
    process.env.INVOICE_PUBLIC_URL_BASE = 'https://func.example.net/api/invoices'
    const url = invoiceUrlFor('2026060812345678')
    expect(url).toMatch(/^https:\/\/func\.example\.net\/api\/invoices\/2026060812345678\.pdf\?token=[0-9a-f]{32}$/)
  })

  it('omits the token query string when INVOICE_SIGNING_KEY is unset', () => {
    delete process.env.INVOICE_SIGNING_KEY
    process.env.INVOICE_PUBLIC_URL_BASE = 'https://func.example.net/api/invoices'
    expect(invoiceUrlFor('2026060812345678')).toBe(
      'https://func.example.net/api/invoices/2026060812345678.pdf',
    )
  })

  it('falls back to PUBLIC_SITE_URL/invoices when INVOICE_PUBLIC_URL_BASE is unset', () => {
    process.env.INVOICE_SIGNING_KEY = TEST_KEY
    delete process.env.INVOICE_PUBLIC_URL_BASE
    process.env.PUBLIC_SITE_URL = 'https://www.example.com'
    const url = invoiceUrlFor('2026060812345678')
    expect(url).toMatch(/^https:\/\/www\.example\.com\/invoices\/2026060812345678\.pdf\?token=[0-9a-f]{32}$/)
  })

  it('the token in the URL verifies against the same invoice number', () => {
    process.env.INVOICE_SIGNING_KEY = TEST_KEY
    process.env.INVOICE_PUBLIC_URL_BASE = 'https://func.example.net/api/invoices'
    const invoice = '2026060812345678'
    const url = invoiceUrlFor(invoice)
    const token = new URL(url).searchParams.get('token')
    expect(verifyInvoiceToken(invoice, token)).toBe(true)
  })

  it('strips trailing slash on the explicit base before composing', () => {
    process.env.INVOICE_SIGNING_KEY = TEST_KEY
    process.env.INVOICE_PUBLIC_URL_BASE = 'https://func.example.net/api/invoices///'
    const url = invoiceUrlFor('2026060812345678')
    expect(url).not.toContain('////')
    expect(url).toMatch(/^https:\/\/func\.example\.net\/api\/invoices\/2026060812345678\.pdf\?token=[0-9a-f]{32}$/)
  })
})
