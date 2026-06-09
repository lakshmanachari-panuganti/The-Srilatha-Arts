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
  type AiImageSource,
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

// ─── /api/admin/products/ai-generate-upload ─────────────────────
// Analyse a still-local image without writing a blob.
//
// The admin UI holds the picked File in state and calls this endpoint
// to get content suggestions BEFORE the product (and its category) is
// finalised. The image bytes go straight to Azure OpenAI as a base64
// data URL; no blob is written here. The real upload happens later, at
// form submit, against /api/admin/upload?title=... once the admin has
// committed to a category - that endpoint derives the SEO filename
// from `title` and writes the blob into the right `products/<category>/`
// folder.
//
// This separation exists because the category dropdown is frequently
// set AFTER the admin clicks Generate, so coupling the upload to the
// AI call would silently bucket files into the wrong folder
// (typically `products/general/`).

const MAX_AI_UPLOAD_FILE_SIZE = 10 * 1024 * 1024 // 10 MB - matches the admin UI's stated limit

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

async function aiGenerateFromFile(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)
  const csrfFail = enforceCsrf(request, origin)
  if (csrfFail) return csrfFail

  const admin = requireAdmin(request)
  if (!admin) return errorResponse('Unauthorized', 401, origin)

  const requestId = randomUUID()

  let file: { buffer: Buffer; name: string } | null = null
  try {
    const formData = await request.formData()
    const f = formData.get('file') as File | null
    if (f) {
      const ab = await f.arrayBuffer()
      file = { buffer: Buffer.from(ab), name: f.name }
    }
  } catch {
    logFailure(context, {
      requestId,
      adminId: admin.adminId,
      code: 'INVALID_INPUT',
      details: 'multipart parse failed',
    })
    return errorJson(origin, 400, 'INVALID_INPUT', requestId)
  }

  if (!file) {
    logFailure(context, {
      requestId,
      adminId: admin.adminId,
      code: 'INVALID_INPUT',
      details: 'file field missing',
    })
    return errorJson(origin, 400, 'INVALID_INPUT', requestId)
  }
  if (file.buffer.length > MAX_AI_UPLOAD_FILE_SIZE) {
    logFailure(context, {
      requestId,
      adminId: admin.adminId,
      code: 'INVALID_INPUT',
      details: `file too large: ${file.buffer.length}`,
    })
    return errorJson(origin, 400, 'INVALID_INPUT', requestId)
  }
  const mime = detectImageMime(file.buffer)
  if (!mime) {
    logFailure(context, {
      requestId,
      adminId: admin.adminId,
      code: 'INVALID_INPUT',
      details: 'magic-byte check failed',
    })
    return errorJson(origin, 400, 'INVALID_INPUT', requestId)
  }

  // Send the original bytes inline as a base64 data URL. We don't
  // re-encode to WebP first - the AI service accepts JPG/PNG/WebP
  // natively and the extra encode would only burn CPU on every call.
  const source: AiImageSource = { kind: 'buffer', buffer: file.buffer, mimeType: mime }

  try {
    const { content, deploymentName } = await generateProductContent(source)
    context.log('aiGenerateFromFile: success', {
      requestId,
      adminId: admin.adminId,
      deploymentName,
      mime,
      timestamp: new Date().toISOString(),
    })
    return jsonResponse(
      { content },
      200,
      { 'X-Request-Id': requestId },
      origin,
    )
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
    logFailure(context, {
      requestId,
      adminId: admin.adminId,
      code: 'INTERNAL_ERROR',
      details: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    })
    return errorJson(origin, 500, 'INTERNAL_ERROR', requestId)
  }
}

app.http('aiGenerateProductContentFromFile', {
  methods: ['POST', 'OPTIONS'],
  route: 'api/admin/products/ai-generate-upload',
  authLevel: 'anonymous',
  handler: aiGenerateFromFile,
})
