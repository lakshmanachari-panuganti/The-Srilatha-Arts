/**
 * Azure OpenAI GPT-4o Vision — product content generation.
 *
 * Returns SEO-friendly e-commerce copy for a product image. The single
 * function below talks to Azure OpenAI via raw fetch (no SDK — the
 * single chat-completions call doesn't justify the extra package weight
 * in the Functions zip).
 *
 * Errors are surfaced as a typed AiContentError carrying:
 *   - `code`: one of AiErrorCode — used to pick a precise user message
 *     on the client AND to drive the structured server log.
 *   - `status`: the HTTP status the route handler should return.
 *   - `azureStatus`: Azure's own status (when applicable) — log-only.
 *   - `details`: short technical detail string — log-only, never shown.
 *
 * The handler logs the full set; the client only ever sees the code +
 * a fixed user-facing message.
 */

export interface AiProductContent {
  title: string
  shortDescription: string
  description: string
  material: string
  careInstructions: string
}

/**
 * Discriminated error codes. The frontend maps each one to a specific
 * user-facing string (see AiGenerateProductContent.tsx). Add new codes
 * in BOTH places when introducing new failure modes.
 */
export type AiErrorCode =
  | 'MISSING_CONFIG'             // env vars not set
  | 'AUTH_ERROR'                 // Azure 401 — bad/expired API key
  | 'DEPLOYMENT_NOT_FOUND'       // Azure 404 — deployment name wrong
  | 'RATE_LIMIT'                 // Azure 429
  | 'SERVICE_UNAVAILABLE'        // Azure 5xx
  | 'TIMEOUT'                    // our AbortController fired
  | 'IMAGE_PROCESSING_ERROR'     // Azure couldn't fetch/decode image
  | 'INVALID_RESPONSE'           // JSON parse failed / unexpected shape
  | 'CONTENT_VALIDATION_FAILED'  // parsed OK but required field empty
  | 'NETWORK_ERROR'              // fetch() rejected without HTTP response
  | 'INVALID_INPUT'              // imageUrl missing / malformed
  | 'INTERNAL_ERROR'             // catch-all

interface AiContentErrorOpts {
  status: number
  azureStatus?: number
  details?: string
}

export class AiContentError extends Error {
  code: AiErrorCode
  status: number
  azureStatus?: number
  details?: string
  constructor(code: AiErrorCode, opts: AiContentErrorOpts) {
    super(code)
    this.name = 'AiContentError'
    this.code = code
    this.status = opts.status
    this.azureStatus = opts.azureStatus
    this.details = opts.details
  }
}

const PROMPT = [
  'You are an expert ecommerce content writer specializing in handmade artwork and home decor products.',
  '',
  'Analyze the uploaded artwork image and generate high-quality ecommerce content.',
  '',
  'Return ONLY valid JSON matching this schema:',
  '{',
  '  "title": "",',
  '  "shortDescription": "",',
  '  "description": "",',
  '  "material": "",',
  '  "careInstructions": ""',
  '}',
  '',
  'Rules:',
  '- Create an SEO-friendly product title (under 80 characters).',
  '- shortDescription must be under 160 characters — a single line, suitable for product cards.',
  '- description should be a detailed ecommerce product description (2–4 short paragraphs).',
  '- material: suggest likely materials used (e.g. "MDF · resin · gold leaf").',
  '- careInstructions: practical guidance for the buyer (avoid sunlight, dust with soft cloth, etc.).',
  '- Return JSON only — no markdown fences, no commentary, no leading or trailing prose.',
].join('\n')

export interface GenerateResult {
  content: AiProductContent
  /** Pass-through info for structured logging. */
  deploymentName: string
}

export async function generateProductContent(imageUrl: string): Promise<GenerateResult> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT
  const apiKey = process.env.AZURE_OPENAI_API_KEY
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview'

  if (!endpoint || !apiKey || !deployment) {
    const missing = [
      !endpoint && 'AZURE_OPENAI_ENDPOINT',
      !apiKey && 'AZURE_OPENAI_API_KEY',
      !deployment && 'AZURE_OPENAI_DEPLOYMENT_NAME',
    ].filter(Boolean).join(', ')
    throw new AiContentError('MISSING_CONFIG', {
      status: 503,
      details: `Missing env vars: ${missing}`,
    })
  }
  if (!imageUrl || !/^https?:\/\//.test(imageUrl)) {
    throw new AiContentError('INVALID_INPUT', {
      status: 400,
      details: 'imageUrl missing or not an http(s) URL',
    })
  }

  const base = endpoint.replace(/\/+$/, '')
  const url = `${base}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: PROMPT },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
        max_tokens: 900,
        temperature: 0.4,
        response_format: { type: 'json_object' },
      }),
    })
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      throw new AiContentError('TIMEOUT', { status: 504, details: '30s AbortController' })
    }
    throw new AiContentError('NETWORK_ERROR', {
      status: 502,
      details: err instanceof Error ? err.message : 'fetch rejected',
    })
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    const azureStatus = response.status
    const rawBody = await response.text().catch(() => '')
    const bodyLower = rawBody.toLowerCase()
    const detail = `Azure ${azureStatus}: ${rawBody.slice(0, 500)}`

    // 401 — bad/expired API key. Azure returns 401 even when the
    // deployment is wrong + the key is wrong, but key issues are
    // overwhelmingly more common; the deployment-not-found case is
    // matched by 404 below.
    if (azureStatus === 401) {
      throw new AiContentError('AUTH_ERROR', { status: 401, azureStatus, details: detail })
    }
    // 404 — deployment name typo or wrong API version (Azure uses
    // DeploymentNotFound in the error body for the former).
    if (azureStatus === 404 || bodyLower.includes('deploymentnotfound') || bodyLower.includes('deployment not found')) {
      throw new AiContentError('DEPLOYMENT_NOT_FOUND', { status: 404, azureStatus, details: detail })
    }
    // 429 — rate limit / quota exhausted.
    if (azureStatus === 429) {
      throw new AiContentError('RATE_LIMIT', { status: 429, azureStatus, details: detail })
    }
    // 5xx — Azure service hiccup.
    if (azureStatus >= 500) {
      throw new AiContentError('SERVICE_UNAVAILABLE', { status: 503, azureStatus, details: detail })
    }
    // 400 with image-related complaint — Azure couldn't fetch / decode
    // the image at the URL we passed. Recognisable patterns:
    //   "Could not download image"
    //   "image_url"
    //   "content_filter"   (vision-content moderation)
    //   "invalid_image"
    //   "unable to process image"
    if (
      azureStatus === 400 &&
      (bodyLower.includes('image') ||
        bodyLower.includes('download') ||
        bodyLower.includes('content_filter') ||
        bodyLower.includes('format'))
    ) {
      throw new AiContentError('IMAGE_PROCESSING_ERROR', {
        status: 400,
        azureStatus,
        details: detail,
      })
    }
    // Any other 4xx — bucket as internal so the user sees the catch-all
    // and we surface the real reason in logs.
    throw new AiContentError('INTERNAL_ERROR', {
      status: 502,
      azureStatus,
      details: detail,
    })
  }

  // Successful HTTP — now validate the body shape.
  let payload: { choices?: { message?: { content?: string } }[] }
  try {
    payload = (await response.json()) as typeof payload
  } catch (err) {
    throw new AiContentError('INVALID_RESPONSE', {
      status: 502,
      details: err instanceof Error ? err.message : 'json parse failed',
    })
  }

  const raw = payload?.choices?.[0]?.message?.content
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new AiContentError('CONTENT_VALIDATION_FAILED', {
      status: 502,
      details: 'choices[0].message.content empty or non-string',
    })
  }

  const content = parseAndValidate(raw)
  return { content, deploymentName: deployment }
}

function parseAndValidate(raw: string): AiProductContent {
  // Defend against the occasional ```json fence even though we asked
  // for json_object response_format.
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim()

  let obj: unknown
  try {
    obj = JSON.parse(stripped)
  } catch {
    throw new AiContentError('INVALID_RESPONSE', {
      status: 502,
      details: 'model output was not valid JSON',
    })
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new AiContentError('INVALID_RESPONSE', {
      status: 502,
      details: 'model output was not a JSON object',
    })
  }

  const o = obj as Record<string, unknown>
  const get = (key: string): string => {
    const v = o[key]
    return typeof v === 'string' ? v.trim() : ''
  }

  const content: AiProductContent = {
    title: get('title').slice(0, 200),
    shortDescription: get('shortDescription').slice(0, 200),
    description: get('description').slice(0, 4000),
    material: get('material').slice(0, 300),
    careInstructions: get('careInstructions').slice(0, 1000),
  }

  // Quality floor: title is mandatory. shortDescription + description
  // are also required since they're the visible product copy. material
  // and careInstructions can reasonably be inferred-empty for some
  // pieces, so we don't reject those.
  if (!content.title || !content.shortDescription || !content.description) {
    const missing = [
      !content.title && 'title',
      !content.shortDescription && 'shortDescription',
      !content.description && 'description',
    ].filter(Boolean).join(', ')
    throw new AiContentError('CONTENT_VALIDATION_FAILED', {
      status: 502,
      details: `required fields empty after parse: ${missing}`,
    })
  }
  return content
}
