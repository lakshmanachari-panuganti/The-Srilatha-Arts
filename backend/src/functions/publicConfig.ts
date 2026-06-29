/**
 * GET /api/config
 *
 * Public, anonymous configuration the SPA needs to render correctly per
 * environment. Lets us toggle features (e.g. CAPTCHA on PRD, off on DEV)
 * without baking environment-specific values into the Next build.
 *
 * Only safe-to-expose values belong here — never secrets. The reCAPTCHA
 * `site key` is a public identifier and is the matching half of the
 * `RECAPTCHA_SECRET` that stays server-side.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { jsonResponse, corsPreflightResponse } from '../utils/response'
import { captchaEnabled } from '../services/captcha'

async function publicConfig(
  request: HttpRequest,
  _context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)

  const enabled = captchaEnabled()
  const siteKey = process.env.RECAPTCHA_SITE_KEY || ''

  return jsonResponse(
    {
      environment: process.env.ENVIRONMENT || 'DEV',
      captcha: {
        enabled: enabled && Boolean(siteKey),
        provider: 'recaptcha-v3',
        siteKey: enabled ? siteKey : '',
      },
    },
    200,
    { 'Cache-Control': 'public, max-age=60' },
    origin,
  )
}

app.http('publicConfig', {
  methods: ['GET', 'OPTIONS'],
  route: 'api/config',
  authLevel: 'anonymous',
  handler: publicConfig,
})
