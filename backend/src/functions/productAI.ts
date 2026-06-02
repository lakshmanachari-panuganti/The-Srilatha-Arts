/**
 * AI-powered product content generation.
 *
 * POST /api/admin/products/ai-generate
 *   body: { imageUrl: string }
 *   200: { title, shortDescription, description, material, careInstructions }
 *   4xx/5xx: { code: AiErrorCode, error: string }
 *
 * Admin only. CSRF protected.
 *
 * Error contract:
 *   The JSON body always includes a stable machine-readable `code` so the
 *   admin UI can render the precise user-facing message for each scenario
 *   (auth error vs deployment-not-found vs rate-limit, etc.). The `error`
 *   string is a short technical hint - never an Azure dump and never
 *   contains API keys or endpoints.
 *
 *   Detailed root-cause information (Azure status, Azure error body,
 *   admin user id, request id) is written to context.error for ops
 *   diagnosis; it is never returned to the client.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { randomUUID } from 'crypto'
import { requireAdmin } from '../middleware/adminGuard'
import { enforceCsrf } from '../middleware/csrfGuard'
import { jsonResponse, errorResponse, corsPreflightResponse } from '../utils/response'
import {
  generateProductContent,
  AiContentError,
  type AiErrorCode,
} from '../services/aiContentGenerator'

// Short, neutral hint strings paired with each code. The real user-facing
// copy lives on the frontend (mapped from `code`) - these strings just
// exist so a curl client or test harness gets something readable.
const ERROR_HINT: Record<AiErrorCode, string> = {
  MISSING_CONFIG: 'AI content generation is not configured.',
  AUTH_ERROR: 'Authentication with AI service failed.',
  DEPLOYMENT_NOT_FOUND: 'Configured AI deployment was not found.',
  RATE_LIMIT: 'AI request limit reached.',
  SERVICE_UNAVAILABLE: 'AI service is temporarily unavailable.',
  TIMEOUT: 'AI service did not respond in time.',
  IMAGE_PROCESSING_ERROR: 'The uploaded image could not be processed.',
  INVALID_RESPONSE: 'AI service returned an invalid response.',
  CONTENT_VALIDATION_FAILED: 'Generated content did not meet quality requirements.',
  NETWORK_ERROR: 'Could not reach AI service.',
  INVALID_INPUT: 'Invalid input.',
  INTERNAL_ERROR: 'Internal application error.',
}

function aiErrorBody(code: AiErrorCode): { code: AiErrorCode; error: string } {
  return { code, error: ERROR_HINT[code] }
}

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

  // Per-request id for log correlation. Surfaced to the client too so
  // they can paste it into a support ticket if needed (it carries no
  // sensitive info).
  const requestId = randomUUID()

  let body: { imageUrl?: string }
  try {
    body = (await request.json()) as { imageUrl?: string }
  } catch {
    logFailure(context, {
      requestId,
      adminId: admin.adminId,
      code: 'INVALID_INPUT',
      details: 'request body was not valid JSON',
    })
    return errorJson(origin, 400, 'INVALID_INPUT', requestId)
  }

  const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : ''
  if (!imageUrl) {
    logFailure(context, {
      requestId,
      adminId: admin.adminId,
      code: 'INVALID_INPUT',
      details: 'imageUrl missing',
    })
    return errorJson(origin, 400, 'INVALID_INPUT', requestId)
  }

  try {
    const { content, deploymentName } = await generateProductContent(imageUrl)
    context.log('aiGenerateContent: success', {
      requestId,
      adminId: admin.adminId,
      deploymentName,
      timestamp: new Date().toISOString(),
    })
    return jsonResponse(content, 200, { 'X-Request-Id': requestId }, origin)
  } catch (err) {
    if (err instanceof AiContentError) {
      logFailure(context, {
        requestId,
        adminId: admin.adminId,
        code: err.code,
        azureStatus: err.azureStatus,
        details: err.details,
        deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
      })
      return errorJson(origin, err.status, err.code, requestId)
    }
    // Truly unexpected - log the full error and surface INTERNAL_ERROR.
    logFailure(context, {
      requestId,
      adminId: admin.adminId,
      code: 'INTERNAL_ERROR',
      details: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
      deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
    })
    return errorJson(origin, 500, 'INTERNAL_ERROR', requestId)
  }
}

// ─── Helpers ────────────────────────────────────────────────────

function errorJson(
  origin: string | null,
  status: number,
  code: AiErrorCode,
  requestId: string,
): HttpResponseInit {
  return jsonResponse(aiErrorBody(code), status, { 'X-Request-Id': requestId }, origin)
}

interface LogPayload {
  requestId: string
  adminId: string
  code: AiErrorCode
  azureStatus?: number
  deploymentName?: string
  details?: string
}

// Structured log line. Never include the API key, endpoint, or anything
// else the user shouldn't see in a log scrape. Fields match the contract
// in the audit brief.
function logFailure(context: InvocationContext, p: LogPayload) {
  context.error('aiGenerateContent failed', {
    errorType: 'AiContentError',
    code: p.code,
    azureStatus: p.azureStatus ?? null,
    deploymentName: p.deploymentName ?? null,
    requestId: p.requestId,
    timestamp: new Date().toISOString(),
    adminId: p.adminId,
    details: p.details ?? null,
  })
}

app.http('aiGenerateProductContent', {
  methods: ['POST', 'OPTIONS'],
  route: 'api/admin/products/ai-generate',
  authLevel: 'anonymous',
  handler: aiGenerateContent,
})
