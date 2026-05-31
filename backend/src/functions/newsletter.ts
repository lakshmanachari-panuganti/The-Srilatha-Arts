/**
 * Newsletter subscription endpoint.
 *
 * POST /api/newsletter — anonymous, rate-limited 5/hour/IP.
 *   Body: { email: string, source?: string }
 *
 * Persists to the `newsletterSubscribers` Table Storage. Status starts
 * at `pending`; a future double-opt-in flow can flip it to `confirmed`
 * after the user clicks an email link. We do NOT yet send a confirmation
 * email — that requires an email service the studio hasn't picked. The
 * row is the foundation; sending is layered on later.
 *
 * NOTE: the Footer previously fake-acknowledged signups in a useState
 * without any persistence. This endpoint replaces that no-op.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { addNewsletterSubscriber } from '../services/tableStorage'
import { enforceCsrf } from '../middleware/csrfGuard'
import { checkAndIncrement } from '../services/rateLimit'
import { jsonResponse, errorResponse, corsPreflightResponse } from '../utils/response'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function getClientIp(request: HttpRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}

async function subscribe(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)
  const csrfFail = enforceCsrf(request, origin)
  if (csrfFail) return csrfFail

  const ip = getClientIp(request)
  const rate = await checkAndIncrement(`newsletter:${ip}`, 5, 3600_000)
  if (!rate.allowed) {
    return errorResponse('Too many sign-ups from this network. Try again later.', 429, origin)
  }

  try {
    const body = (await request.json()) as { email?: string; source?: string }
    const email = String(body.email || '').trim()
    if (!email) return errorResponse('Email is required', 400, origin)
    if (email.length > 254) return errorResponse('Email is too long', 400, origin)
    if (!EMAIL_RE.test(email)) return errorResponse('Invalid email format', 400, origin)

    const source = typeof body.source === 'string' && body.source.length <= 50
      ? body.source
      : 'footer'

    await addNewsletterSubscriber(email, source)
    return jsonResponse(
      {
        ok: true,
        message: 'Thanks — we’ll send a note when the studio newsletter launches.',
      },
      201,
      {},
      origin,
    )
  } catch (err) {
    context.error('newsletter subscribe failed', err)
    return errorResponse('Could not subscribe right now. Please try again later.', 500, origin)
  }
}

app.http('newsletterSubscribe', {
  methods: ['POST', 'OPTIONS'],
  route: 'api/newsletter',
  authLevel: 'anonymous',
  handler: subscribe,
})
