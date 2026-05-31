/**
 * AI-powered product content generation.
 *
 * POST /api/admin/products/ai-generate
 *   body: { imageUrl: string }
 *   returns: { title, shortDescription, description, material, careInstructions }
 *
 * Admin only. CSRF protected. Triggered from the admin product create/edit
 * pages after the artwork image has been uploaded. The frontend pastes
 * the returned strings into the form's title / shortDescription /
 * description / material / careInstructions fields. Nothing else is
 * touched (price, category, stock flags etc. are business decisions).
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { requireAdmin } from '../middleware/adminGuard'
import { enforceCsrf } from '../middleware/csrfGuard'
import { jsonResponse, errorResponse, corsPreflightResponse } from '../utils/response'
import { generateProductContent, AiContentError } from '../services/aiContentGenerator'

async function aiGenerateContent(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)
  const csrfFail = enforceCsrf(request, origin)
  if (csrfFail) return csrfFail

  const admin = requireAdmin(request)
  if (!admin) return errorResponse('Unauthorized', 401, origin)

  let body: { imageUrl?: string }
  try {
    body = (await request.json()) as { imageUrl?: string }
  } catch {
    return errorResponse('Invalid JSON body', 400, origin)
  }

  const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : ''
  if (!imageUrl) {
    return errorResponse('imageUrl is required', 400, origin)
  }

  try {
    const content = await generateProductContent(imageUrl)
    return jsonResponse(content, 200, {}, origin)
  } catch (err) {
    if (err instanceof AiContentError) {
      // Log detailed error server-side; return a friendly message to the client.
      context.error('aiGenerateContent failed', { status: err.status, error: err.message })
      const userMessage =
        err.status === 503
          ? 'AI content generation is not available right now.'
          : err.status === 504
            ? 'AI generation timed out. Please try again.'
            : err.status === 400
              ? err.message
              : 'Unable to generate product details. Please try again.'
      return errorResponse(userMessage, err.status, origin)
    }
    context.error('aiGenerateContent unexpected error', err)
    return errorResponse('Unable to generate product details. Please try again.', 500, origin)
  }
}

app.http('aiGenerateProductContent', {
  methods: ['POST', 'OPTIONS'],
  route: 'api/admin/products/ai-generate',
  authLevel: 'anonymous',
  handler: aiGenerateContent,
})
