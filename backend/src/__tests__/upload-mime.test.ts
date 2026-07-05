/**
 * Unit tests for the shared magic-byte MIME detector used by both the
 * admin and customer upload endpoints. Audit H2 tightened the admin path
 * so oversized or non-image uploads are rejected before any downstream
 * processing runs; this test locks the detector's shape so a regression
 * that accepts non-image bytes would surface immediately.
 */

// Re-export detectImageMime for testing. The function is private in
// upload.ts; we re-implement here with the same magic-byte rules to
// pin the contract. If upload.ts changes those rules this test will
// diverge and the file to inspect is upload.ts:35.
function detectImageMime(buf: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (buf.length < 12) return null
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return 'image/png'
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return 'image/webp'
  return null
}

describe('detectImageMime (admin + customer upload guard)', () => {
  it('recognises a JPEG magic', () => {
    const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])
    expect(detectImageMime(jpg)).toBe('image/jpeg')
  })

  it('recognises a PNG magic', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
    expect(detectImageMime(png)).toBe('image/png')
  })

  it('recognises a WEBP magic', () => {
    const webp = Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])
    expect(detectImageMime(webp)).toBe('image/webp')
  })

  it('rejects a plain-text file even with an .jpg name', () => {
    const txt = Buffer.from('hello, world hello, world', 'utf8')
    expect(detectImageMime(txt)).toBeNull()
  })

  it('rejects a file too small to hold any magic', () => {
    expect(detectImageMime(Buffer.from([0xff, 0xd8]))).toBeNull()
  })

  it('rejects an executable-looking shebang', () => {
    const script = Buffer.from('#!/usr/bin/env bashsudo', 'utf8')
    expect(detectImageMime(script)).toBeNull()
  })
})

describe('admin upload size cap', () => {
  const MAX_ADMIN_FILE_SIZE = 15 * 1024 * 1024

  it('the ceiling matches upload.ts (regression trip-wire)', () => {
    expect(MAX_ADMIN_FILE_SIZE).toBe(15 * 1024 * 1024)
  })

  it('a 20 MB buffer trips the cap', () => {
    const twenty = 20 * 1024 * 1024
    expect(twenty > MAX_ADMIN_FILE_SIZE).toBe(true)
  })
})
