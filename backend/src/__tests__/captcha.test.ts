/**
 * Unit tests for services/captcha.ts.
 *
 * Verifies the env-gated bypass (DEV path) and the verify-endpoint
 * response handling (success / missing-secret / low-score / action
 * mismatch / network failure). Uses jest's fetch mock; no real HTTP.
 */

import { verifyCaptcha, captchaEnabled } from '../services/captcha'

const ORIGINAL_ENV = process.env

beforeEach(() => {
  jest.resetModules()
  process.env = { ...ORIGINAL_ENV }
  delete process.env.CAPTCHA_ENABLED
  delete process.env.RECAPTCHA_SECRET
  delete process.env.RECAPTCHA_SCORE_THRESHOLD
})

afterAll(() => {
  process.env = ORIGINAL_ENV
})

describe('verifyCaptcha — disabled (DEV)', () => {
  it('returns ok=true without calling fetch when CAPTCHA_ENABLED is unset', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch')
    const res = await verifyCaptcha('whatever', 'login')
    expect(res.ok).toBe(true)
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it('returns ok=true when CAPTCHA_ENABLED is "false"', async () => {
    process.env.CAPTCHA_ENABLED = 'false'
    const res = await verifyCaptcha('whatever', 'login')
    expect(res.ok).toBe(true)
  })

  it('captchaEnabled() reflects the env flag', () => {
    expect(captchaEnabled()).toBe(false)
    process.env.CAPTCHA_ENABLED = 'true'
    expect(captchaEnabled()).toBe(true)
  })
})

describe('verifyCaptcha — enabled', () => {
  beforeEach(() => {
    process.env.CAPTCHA_ENABLED = 'true'
    process.env.RECAPTCHA_SECRET = 'test-secret'
  })

  it('fails fast when RECAPTCHA_SECRET is missing', async () => {
    delete process.env.RECAPTCHA_SECRET
    const res = await verifyCaptcha('token', 'login')
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('captcha-misconfigured')
  })

  it('fails when token is missing or non-string', async () => {
    const res = await verifyCaptcha(undefined, 'login')
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('captcha-missing')
  })

  it('passes when Google verify returns success + matching action + good score', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, action: 'login', score: 0.9 }),
    } as Response)
    const res = await verifyCaptcha('token', 'login', '1.2.3.4')
    expect(res.ok).toBe(true)
    expect(res.score).toBe(0.9)
  })

  it('rejects on Google success=false', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }),
    } as Response)
    const res = await verifyCaptcha('bad', 'login')
    expect(res.ok).toBe(false)
    expect(res.reason).toContain('captcha-rejected')
  })

  it('rejects on action mismatch', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, action: 'register', score: 0.9 }),
    } as Response)
    const res = await verifyCaptcha('token', 'login')
    expect(res.ok).toBe(false)
    expect(res.reason).toContain('captcha-action-mismatch')
  })

  it('rejects on score below threshold', async () => {
    process.env.RECAPTCHA_SCORE_THRESHOLD = '0.7'
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, action: 'login', score: 0.4 }),
    } as Response)
    const res = await verifyCaptcha('token', 'login')
    expect(res.ok).toBe(false)
    expect(res.reason).toContain('captcha-low-score')
    expect(res.score).toBe(0.4)
  })

  it('rejects when verify endpoint returns HTTP error', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => ({}),
    } as Response)
    const res = await verifyCaptcha('token', 'login')
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('captcha-verify-http-502')
  })

  it('rejects when fetch itself throws', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('boom'))
    const res = await verifyCaptcha('token', 'login')
    expect(res.ok).toBe(false)
    expect(res.reason).toContain('captcha-verify-fetch-failed')
  })
})
